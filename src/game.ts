// The table: 5 seats, no-limit hold'em, blinds 1/2, 200-chip stacks, the button moves one seat
// clockwise each hand. Seat 0 is you. Computer players start every hand with 200; you rebuy 200
// whenever you run out.
import { Card, cardLabel, handClass, shuffledDeck } from "./engine/cards";
import { describe, evaluate } from "./engine/evaluate";
import { exactEquity } from "./engine/equity";
import { Book, Move, Position, POSITIONS, postflopBook, potOdds, preflopBook } from "./engine/strategy";

export const SEATS = 5;
export const SB = 1;
export const BB = 2;
export const START_STACK = 200;

export type Street = "preflop" | "flop" | "turn" | "river";
export type Style = "you" | "tight" | "loose" | "aggressive" | "steady";

export interface Player {
  name: string;
  human: boolean;
  style: Style;
  stack: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  bet: number; // chips put in on this street
  total: number; // chips put in this hand
  acted: boolean; // has acted since the last full raise
  last: string | null; // last action label for the seat
}

export interface Award {
  seat: number;
  amount: number;
  hand: string | null; // null when everyone else folded
}

export interface Table {
  hand: number;
  button: number;
  players: Player[];
  deck: Card[];
  board: Card[];
  street: Street;
  phase: "idle" | "betting" | "done";
  toAct: number;
  currentBet: number;
  minRaise: number;
  raises: number; // preflop raises, not counting the big blind
  awards: Award[];
  showdown: boolean;
  rebuys: number; // net chips added (rebuys, computer top-ups and trims) over the table's life
  startStacks: number[]; // stacks at the start of this hand, after rebuys
}

export type Action = { type: "fold" } | { type: "check" } | { type: "call" } | { type: "raise"; to: number };

const NAMES: [string, Style][] = [
  ["You", "you"],
  ["Ava", "tight"],
  ["Ben", "loose"],
  ["Cal", "aggressive"],
  ["Dee", "steady"],
];

export function newTable(): Table {
  return {
    hand: 0,
    button: SEATS - 1, // the first hand moves it to seat 0
    players: NAMES.map(([name, style], i) => ({
      name,
      human: i === 0,
      style,
      stack: START_STACK,
      hole: [],
      folded: false,
      allIn: false,
      bet: 0,
      total: 0,
      acted: false,
      last: null,
    })),
    deck: [],
    board: [],
    street: "preflop",
    phase: "idle",
    toAct: -1,
    currentBet: 0,
    minRaise: BB,
    raises: 0,
    awards: [],
    showdown: false,
    rebuys: 0,
    startStacks: Array(SEATS).fill(START_STACK),
  };
}

const clone = (t: Table): Table => ({ ...t, players: t.players.map((p) => ({ ...p, hole: [...p.hole] })), deck: [...t.deck], board: [...t.board], awards: [...t.awards] });
const next = (i: number) => (i + 1) % SEATS;

export const positionOf = (seat: number, button: number): Position => POSITIONS[(seat - button + SEATS) % SEATS];
export const potTotal = (t: Table) => t.players.reduce((a, p) => a + p.total, 0);
export const chipsOnTable = (t: Table) => t.players.reduce((a, p) => a + p.stack + p.total, 0);

function put(p: Player, amount: number) {
  const a = Math.min(amount, p.stack);
  p.stack -= a;
  p.bet += a;
  p.total += a;
  if (p.stack === 0) p.allIn = true;
  return a;
}

export function startHand(prev: Table): Table {
  const t = clone(prev);
  for (const p of t.players) {
    // computer players sit down with exactly 200 every hand; you rebuy 200 when you run out
    if (!p.human || p.stack === 0) {
      t.rebuys += START_STACK - p.stack;
      p.stack = START_STACK;
    }
    Object.assign(p, { hole: [], folded: false, allIn: false, bet: 0, total: 0, acted: false, last: null });
  }
  t.hand++;
  t.button = next(t.button);
  t.deck = shuffledDeck();
  t.board = [];
  t.street = "preflop";
  t.awards = [];
  t.showdown = false;
  t.startStacks = t.players.map((p) => p.stack);
  for (let r = 0; r < 2; r++) for (let k = 1; k <= SEATS; k++) t.players[(t.button + k) % SEATS].hole.push(t.deck.pop()!);
  const sb = t.players[(t.button + 1) % SEATS];
  const bb = t.players[(t.button + 2) % SEATS];
  put(sb, SB);
  sb.last = `SB ${sb.bet}`;
  put(bb, BB);
  bb.last = `BB ${bb.bet}`;
  t.currentBet = BB;
  t.minRaise = BB;
  t.raises = 0;
  t.phase = "betting";
  t.toAct = (t.button + 2) % SEATS;
  return advance(t, (t.button + 2) % SEATS);
}

export interface Legal {
  toCall: number;
  canCheck: boolean;
  canRaise: boolean;
  minTo: number;
  maxTo: number;
}

export function legal(t: Table, seat = t.toAct): Legal {
  const p = t.players[seat];
  const toCall = Math.min(t.currentBet - p.bet, p.stack);
  const maxTo = p.bet + p.stack;
  const others = t.players.some((q, i) => i !== seat && !q.folded && !q.allIn);
  const canRaise = !p.acted && maxTo > t.currentBet && others;
  const minTo = Math.min(t.currentBet === 0 ? BB : t.currentBet + t.minRaise, maxTo);
  return { toCall, canCheck: toCall === 0, canRaise, minTo, maxTo };
}

export function act(prev: Table, seat: number, a: Action): Table {
  if (prev.phase !== "betting" || prev.toAct !== seat) return prev;
  const t = clone(prev);
  const p = t.players[seat];
  const L = legal(prev, seat);
  if (a.type === "fold") {
    p.folded = true;
    p.last = "Fold";
  } else if (a.type === "check" || (a.type === "call" && L.toCall === 0)) {
    if (!L.canCheck) return prev;
    p.last = "Check";
  } else if (a.type === "call") {
    put(p, L.toCall);
    p.last = p.allIn ? `All in ${p.bet}` : `Call ${p.bet}`;
  } else {
    if (!L.canRaise) return act(prev, seat, { type: L.canCheck ? "check" : "call" });
    const to = Math.max(L.minTo, Math.min(L.maxTo, Math.round(a.to)));
    const size = to - t.currentBet;
    put(p, to - p.bet);
    if (size >= t.minRaise) {
      t.minRaise = size;
      for (const q of t.players) if (q !== p) q.acted = false; // a full raise reopens the action
    }
    const wasBet = t.currentBet === 0;
    t.currentBet = Math.max(t.currentBet, p.bet);
    if (t.street === "preflop") t.raises++;
    p.last = p.allIn ? `All in ${p.bet}` : `${wasBet ? "Bet" : "Raise to"} ${p.bet}`;
  }
  p.acted = true;
  return advance(t, seat);
}

const needsToAct = (t: Table, p: Player) => !p.folded && !p.allIn && (!p.acted || p.bet < t.currentBet);

/** Move to the next player, the next street, or the end of the hand. Mutates t. */
function advance(t: Table, from: number): Table {
  const live = t.players.filter((p) => !p.folded);
  if (live.length === 1) return finish(t, false);
  for (let k = 1; k <= SEATS; k++) {
    const i = (from + k) % SEATS;
    if (needsToAct(t, t.players[i])) {
      t.toAct = i;
      return t;
    }
  }
  // betting round over
  for (const p of t.players) {
    p.bet = 0;
    p.acted = false;
  }
  t.currentBet = 0;
  t.minRaise = BB;
  const canBet = live.filter((p) => !p.allIn).length;
  if (t.street === "river") return finish(t, true);
  dealStreet(t);
  if (canBet <= 1) {
    while (t.board.length < 5) dealStreet(t);
    return finish(t, true);
  }
  for (const p of t.players) if (!p.folded && !p.allIn) p.last = null;
  return advance(t, t.button);
}

function dealStreet(t: Table) {
  t.deck.pop(); // burn
  if (t.board.length === 0) {
    t.board.push(t.deck.pop()!, t.deck.pop()!, t.deck.pop()!);
    t.street = "flop";
  } else {
    t.board.push(t.deck.pop()!);
    t.street = t.board.length === 4 ? "turn" : "river";
  }
}

/** Award the pot (and any side pots). Mutates t. */
function finish(t: Table, showdown: boolean): Table {
  t.phase = "done";
  t.toAct = -1;
  t.showdown = showdown;
  const won = new Map<number, number>();
  const handName = new Map<number, string>();
  if (!showdown) {
    const w = t.players.findIndex((p) => !p.folded);
    won.set(w, potTotal(t));
  } else {
    const scores = t.players.map((p) => (p.folded ? -1 : evaluate([...p.hole, ...t.board])));
    t.players.forEach((p, i) => !p.folded && handName.set(i, describe(scores[i])));
    const levels = [...new Set(t.players.map((p) => p.total).filter((x) => x > 0))].sort((a, b) => a - b);
    let prevLevel = 0;
    let carry = 0;
    for (const L of levels) {
      let pot = carry;
      for (const p of t.players) pot += Math.min(p.total, L) - Math.min(p.total, prevLevel);
      prevLevel = L;
      const eligible = t.players.map((_, i) => i).filter((i) => !t.players[i].folded && t.players[i].total >= L);
      if (eligible.length === 0) {
        carry = pot;
        continue;
      }
      carry = 0;
      const best = Math.max(...eligible.map((i) => scores[i]));
      // winners in order from the first seat left of the button, so odd chips go there
      const winners: number[] = [];
      for (let k = 1; k <= SEATS; k++) {
        const i = (t.button + k) % SEATS;
        if (eligible.includes(i) && scores[i] === best) winners.push(i);
      }
      const share = Math.floor(pot / winners.length);
      let odd = pot - share * winners.length;
      for (const i of winners) {
        won.set(i, (won.get(i) ?? 0) + share + (odd > 0 ? 1 : 0));
        odd--;
      }
    }
    if (carry > 0) {
      // cannot normally happen; keep chips conserved by giving them to the best live hand
      const i = scores.indexOf(Math.max(...scores));
      won.set(i, (won.get(i) ?? 0) + carry);
    }
  }
  t.awards = [...won.entries()].map(([seat, amount]) => ({ seat, amount, hand: handName.get(seat) ?? null }));
  for (const [seat, amount] of won) t.players[seat].stack += amount;
  for (const p of t.players) p.bet = 0;
  return t;
}

/** Net chips each seat won or lost in the finished hand. */
export const handNet = (t: Table) => t.players.map((p, i) => p.stack - t.startStacks[i]);

// ---------------------------------------------------------------- grading your decisions

export interface Spot {
  street: Street;
  position: Position;
  cls: string;
  hole: Card[];
  board: Card[];
  toCall: number;
  pot: number;
  potOdds: number;
  equity: { win: number; tie: number; equity: number; cases: number } | null; // null preflop
  handName: string | null;
  book: Book;
  canRaise: boolean;
  raises: number;
}

const spotCache = new Map<string, Spot>();

/** Everything the coach and the grader need for your current decision. */
export function spotFor(t: Table, seat = 0): Spot | null {
  if (t.phase !== "betting" || t.toAct !== seat) return null;
  const key = `${t.hand}|${t.street}|${t.board.join(",")}|${t.players.map((p) => p.total).join(",")}|${t.currentBet}`;
  const hit = spotCache.get(key);
  if (hit) return hit;
  const p = t.players[seat];
  const L = legal(t, seat);
  const position = positionOf(seat, t.button);
  const cls = handClass(p.hole[0], p.hole[1]);
  const pot = potTotal(t);
  let equity: Spot["equity"] = null;
  let handName: string | null = null;
  let book: Book;
  if (t.street === "preflop") {
    book = preflopBook(cls, { position, raises: t.raises, canCheck: L.canCheck });
  } else {
    const e = exactEquity([p.hole[0], p.hole[1]], t.board);
    equity = { win: e.win, tie: e.tie, equity: e.equity, cases: e.cases };
    handName = describe(evaluate([...p.hole, ...t.board]));
    book = postflopBook({ equity: e.equity, toCall: L.toCall, pot, canRaise: L.canRaise });
  }
  if (book.move === "raise" && !L.canRaise) book = { move: "call", reason: `${book.reason} You can't raise here, so ${L.canCheck ? "check" : "call"}.` };
  if (book.move === "fold" && L.canCheck) book = { move: "call", reason: "Checking is free, so never fold here." };
  const spot: Spot = {
    street: t.street,
    position,
    cls,
    hole: [...p.hole],
    board: [...t.board],
    toCall: L.toCall,
    pot,
    potOdds: potOdds(L.toCall, pot),
    equity,
    handName,
    book,
    canRaise: L.canRaise,
    raises: t.raises,
  };
  if (spotCache.size > 200) spotCache.clear();
  spotCache.set(key, spot);
  return spot;
}

export const moveOf = (a: Action): Move => (a.type === "fold" ? "fold" : a.type === "raise" ? "raise" : "call");

export interface Decision {
  hand: number;
  street: Street;
  position: Position;
  cls: string;
  situation: string; // "unopened", "facing a raise", "facing a re-raise", "facing a bet", "checked to you"
  cards: string[];
  board: string[];
  choice: Move;
  book: Move;
  correct: boolean;
  reason: string;
  equity: number | null;
  potOdds: number;
  toCall: number;
  pot: number;
}

export function decisionFrom(spot: Spot, t: Table, a: Action): Decision {
  let choice = moveOf(a);
  // a "raise" that can't be a raise is really a call or check
  if (choice === "raise" && !spot.canRaise) choice = "call";
  return {
    hand: t.hand,
    street: spot.street,
    position: spot.position,
    cls: spot.cls,
    situation: situationOf(spot),
    cards: spot.hole.map(cardLabel),
    board: spot.board.map(cardLabel),
    choice,
    book: spot.book.move,
    correct: choice === spot.book.move,
    reason: spot.book.reason,
    equity: spot.equity?.equity ?? null,
    potOdds: spot.potOdds,
    toCall: spot.toCall,
    pot: spot.pot,
  };
}

export function situationOf(s: { street: Street; raises: number; toCall: number }): string {
  if (s.street === "preflop") return s.raises === 0 ? "unopened" : s.raises === 1 ? "facing a raise" : "facing a re-raise";
  return s.toCall > 0 ? "facing a bet" : "checked to you";
}
