// The "book" this trainer grades against.
//
// Preflop: a fixed, simplified 5-handed chart by position. It is a standard-style chart, not a
// proven optimum (no proven book exists for 5-handed no-limit hold'em), and the app says so.
//
// Flop, turn and river: grading uses one calculated number, your exact equity against one random
// hand, compared with simple fixed rules:
//   - Nobody has bet: bet with 50% equity or more, otherwise check.
//   - Facing a bet: fold if equity is below the pot odds, raise with 70% or more, otherwise call.
import { RANKS } from "./cards";

export type Move = "fold" | "call" | "raise"; // "call" also covers check; "raise" also covers bet
export type Position = "UTG" | "CO" | "BTN" | "SB" | "BB";

export const POSITIONS: Position[] = ["BTN", "SB", "BB", "UTG", "CO"]; // offset from the button
export const BET_THRESHOLD = 0.5;
export const RAISE_THRESHOLD = 0.7;

/** Parse "77+, A2s+, KTs+, ATo+, JTs, 22-99, A2s-A8s" into a set of hand classes. */
export function parseRange(spec: string): Set<string> {
  const out = new Set<string>();
  const ri = (ch: string) => RANKS.indexOf(ch);
  for (const raw of spec.split(",")) {
    const t = raw.trim();
    if (!t) continue;
    const dash = t.indexOf("-");
    if (dash > 0) {
      const a = t.slice(0, dash);
      const b = t.slice(dash + 1);
      if (a[0] === a[1]) {
        const [lo, hi] = [ri(a[0]), ri(b[0])].sort((x, y) => x - y);
        for (let r = lo; r <= hi; r++) out.add(RANKS[r] + RANKS[r]);
      } else {
        const [lo, hi] = [ri(a[1]), ri(b[1])].sort((x, y) => x - y);
        for (let r = lo; r <= hi; r++) out.add(a[0] + RANKS[r] + a[2]);
      }
    } else if (t.endsWith("+")) {
      const h = t.slice(0, -1);
      if (h[0] === h[1]) {
        for (let r = ri(h[0]); r <= 12; r++) out.add(RANKS[r] + RANKS[r]);
      } else {
        const hiR = ri(h[0]);
        for (let r = ri(h[1]); r < hiR; r++) out.add(h[0] + RANKS[r] + h[2]);
      }
    } else out.add(t);
  }
  return out;
}

/** Raise-first-in ranges. Everything else folds when the pot is unopened. */
export const OPEN: Record<Exclude<Position, "BB">, Set<string>> = {
  UTG: parseRange("55+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, ATo+, KJo+, QJo"),
  CO: parseRange("22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A8o+, KTo+, QTo+, JTo"),
  BTN: parseRange("22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o"),
  SB: parseRange("22+, A2s+, K5s+, Q7s+, J7s+, T7s+, 97s+, 86s+, 76s, 65s, 54s, A5o+, K9o+, Q9o+, J9o+, T9o"),
};

/** Facing one raise. */
export const THREE_BET = parseRange("TT+, AQs+, AKo");
export const CALL_RAISE = parseRange("22-99, ATs-AJs, KTs+, QTs+, JTs, T9s, 98s, AJo-AQo, KQo");
export const CALL_RAISE_BB_EXTRA = parseRange("A2s-A9s, K9s, Q9s, J9s, 87s, 76s, ATo, KJo, QJo");

/** Facing a re-raise (two or more raises). */
export const FOUR_BET = parseRange("QQ+, AKs, AKo");
export const CALL_RERAISE = parseRange("TT-JJ, AQs");

export interface PreflopSpot {
  position: Position;
  raises: number; // raises so far this hand, not counting the big blind
  canCheck: boolean; // nothing to call (big blind option)
}

export interface Book {
  move: Move;
  reason: string;
}

export function preflopBook(cls: string, spot: PreflopSpot): Book {
  const { position: pos, raises } = spot;
  if (raises === 0) {
    if (pos === "BB") {
      if (THREE_BET.has(cls)) return { move: "raise", reason: `${cls} is strong enough to raise from the big blind.` };
      return { move: "call", reason: "Check your option. The chart only raises premium hands here." };
    }
    if (OPEN[pos].has(cls)) return { move: "raise", reason: `${cls} is in the ${pos} opening range. Raise first in; don't limp.` };
    return { move: "fold", reason: `${cls} is outside the ${pos} opening range. Fold rather than limp.` };
  }
  if (raises === 1) {
    if (THREE_BET.has(cls)) return { move: "raise", reason: `${cls} is in the 3-bet range against a single raise.` };
    if (CALL_RAISE.has(cls)) return { move: "call", reason: `${cls} plays well enough to call one raise.` };
    if (pos === "BB" && CALL_RAISE_BB_EXTRA.has(cls))
      return { move: "call", reason: `In the big blind you already have chips in, so ${cls} can call one raise.` };
    return { move: "fold", reason: `${cls} is too weak to continue against a raise${pos === "BB" ? ", even from the big blind" : ""}.` };
  }
  if (FOUR_BET.has(cls)) return { move: "raise", reason: `${cls} is strong enough to re-raise against a 3-bet.` };
  if (CALL_RERAISE.has(cls)) return { move: "call", reason: `${cls} can call a re-raise but isn't strong enough to raise again.` };
  return { move: "fold", reason: `Against a re-raise the chart continues only with TT+, AQs and AK.` };
}

export interface PostflopSpot {
  equity: number; // exact, vs one random hand
  toCall: number;
  pot: number; // all chips in the middle, including this street's bets, before you act
  canRaise: boolean;
}

export const potOdds = (toCall: number, pot: number) => (toCall <= 0 ? 0 : toCall / (pot + toCall));

export function postflopBook(s: PostflopSpot): Book {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const eq = pct(s.equity);
  if (s.toCall <= 0) {
    if (s.equity >= BET_THRESHOLD && s.canRaise)
      return { move: "raise", reason: `Your equity is ${eq}, at least 50%: you beat a random hand more often than not, so bet.` };
    return { move: "call", reason: `Your equity is ${eq}, under 50%. Check: it's free to see the next card.` };
  }
  const po = potOdds(s.toCall, s.pot);
  if (s.equity < po)
    return { move: "fold", reason: `Your equity is ${eq}, but calling needs ${pct(po)} (${s.toCall} to win ${s.pot + s.toCall}). Fold.` };
  if (s.equity >= RAISE_THRESHOLD && s.canRaise)
    return { move: "raise", reason: `Your equity is ${eq}, 70% or more, and well above the ${pct(po)} you need. Raise.` };
  return { move: "call", reason: `Your equity is ${eq}, above the ${pct(po)} you need (${s.toCall} to win ${s.pot + s.toCall}). Call.` };
}

export const MOVE_LABEL: Record<Move, string> = { fold: "Fold", call: "Check / call", raise: "Bet / raise" };

/** The move in words for a specific spot: "Check" or "Call", "Bet" or "Raise". */
export const moveText = (m: Move, toCall: number) => (m === "fold" ? "Fold" : m === "call" ? (toCall > 0 ? "Call" : "Check") : toCall > 0 ? "Raise" : "Bet");
