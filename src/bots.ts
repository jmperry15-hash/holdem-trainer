// Computer players. Simple rule-based styles, not optimal play.
//   Ava  tight:      opens a tighter range, needs more equity to continue.
//   Ben  loose:      opens wider, calls more.
//   Cal  aggressive: bets and bluffs more often.
//   Dee  steady:     plays the chart and the plain pot-odds rule.
import { handClass } from "./engine/cards";
import { sampledEquity } from "./engine/equity";
import { CALL_RAISE, CALL_RAISE_BB_EXTRA, CALL_RERAISE, FOUR_BET, OPEN, Position, THREE_BET, potOdds } from "./engine/strategy";
import { Action, BB, Style, Table, legal, positionOf, potTotal } from "./game";

interface Persona {
  openAs: Partial<Record<Position, Exclude<Position, "BB">>>; // borrow another seat's opening range
  wideCall: boolean;
  margin: number; // extra equity needed over pot odds to call
  betAt: number; // equity needed to bet
  bluff: number; // chance to bet or raise with nothing
}

const PERSONAS: Record<Exclude<Style, "you">, Persona> = {
  tight: { openAs: { CO: "UTG", BTN: "CO", SB: "UTG" }, wideCall: false, margin: 0.06, betAt: 0.62, bluff: 0.03 },
  loose: { openAs: { UTG: "CO", CO: "BTN", SB: "BTN" }, wideCall: true, margin: -0.04, betAt: 0.58, bluff: 0.06 },
  aggressive: { openAs: { UTG: "CO", CO: "BTN" }, wideCall: false, margin: 0.0, betAt: 0.5, bluff: 0.16 },
  steady: { openAs: {}, wideCall: false, margin: 0.0, betAt: 0.55, bluff: 0.04 },
};

export function botAction(t: Table, seat: number, rand: () => number = Math.random): Action {
  const p = t.players[seat];
  const persona = PERSONAS[p.style === "you" ? "steady" : p.style];
  const L = legal(t, seat);
  const passive: Action = L.canCheck ? { type: "check" } : { type: "fold" };
  const raiseTo = (to: number): Action => {
    if (!L.canRaise) return L.canCheck ? { type: "check" } : { type: "call" };
    let x = Math.max(L.minTo, Math.min(L.maxTo, Math.round(to)));
    if (x > 0.6 * L.maxTo) x = L.maxTo; // commit fully rather than leave a tiny stack
    return { type: "raise", to: x };
  };

  if (t.street === "preflop") {
    const cls = handClass(p.hole[0], p.hole[1]);
    const pos = positionOf(seat, t.button);
    const limpers = t.players.filter((q, i) => i !== seat && q.total === BB && !q.folded && positionOf(i, t.button) !== "BB").length;
    if (t.raises === 0) {
      if (pos === "BB") return THREE_BET.has(cls) ? raiseTo(4 * BB + limpers * BB) : { type: "check" };
      const range = OPEN[persona.openAs[pos] ?? pos];
      if (range.has(cls)) return raiseTo((pos === "SB" ? 3 : 2.5) * BB + limpers * BB);
      return passive;
    }
    if (t.raises === 1) {
      if (THREE_BET.has(cls)) return raiseTo(3 * t.currentBet);
      if (CALL_RAISE.has(cls) && persona.bluff > 0.1 && rand() < 0.15) return raiseTo(3 * t.currentBet);
      if (CALL_RAISE.has(cls) || ((pos === "BB" || persona.wideCall) && CALL_RAISE_BB_EXTRA.has(cls))) return { type: "call" };
      return passive;
    }
    if (FOUR_BET.has(cls)) return raiseTo(2.3 * t.currentBet);
    if (CALL_RERAISE.has(cls)) return { type: "call" };
    return passive;
  }

  // flop, turn, river: a quick sampled equity, discounted for each extra opponent
  const opponents = t.players.filter((q, i) => i !== seat && !q.folded).length;
  const eq = Math.pow(sampledEquity([p.hole[0], p.hole[1]], t.board, 300, rand), Math.max(1, opponents));
  const pot = potTotal(t);
  if (L.toCall === 0) {
    if (eq >= persona.betAt) return raiseTo(Math.max(BB, (2 / 3) * pot));
    if (rand() < persona.bluff) return raiseTo(Math.max(BB, 0.5 * pot));
    return { type: "check" };
  }
  const need = potOdds(L.toCall, pot);
  if (eq >= 0.8 && L.canRaise) return raiseTo(t.currentBet * 2 + pot * 0.5);
  if (eq >= need + persona.margin) return { type: "call" };
  if (L.canRaise && rand() < persona.bluff * 0.3) return raiseTo(t.currentBet * 2.5);
  return { type: "fold" };
}
