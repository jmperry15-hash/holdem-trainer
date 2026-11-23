// Exact equity of your two cards against ONE random hand, by full enumeration of every opponent
// hand and every remaining board. Used on the flop, turn and river. No sampling, no estimates.
import { Card } from "./cards";
import { evaluate } from "./evaluate";

export interface Equity {
  win: number; // probabilities 0..1
  tie: number;
  lose: number;
  equity: number; // win + tie / 2
  cases: number; // number of (opponent hand, board) combinations counted
}

export interface EquityJob {
  /** Do up to `budget` hand evaluations. Returns true when finished. */
  step(budget: number): boolean;
  result(): Equity;
  progress(): number;
}

function remainingCards(known: Card[]): Card[] {
  const used = new Uint8Array(52);
  for (const c of known) used[c] = 1;
  const out: Card[] = [];
  for (let c = 0; c < 52; c++) if (!used[c]) out.push(c);
  return out;
}

/** Every way to finish the board: a list of 0, 1 or 2 card runouts. */
function runouts(rest: Card[], need: number): Card[][] {
  if (need === 0) return [[]];
  if (need === 1) return rest.map((c) => [c]);
  const out: Card[][] = [];
  for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) out.push([rest[i], rest[j]]);
  return out;
}

export function equityJob(hole: [Card, Card], board: Card[]): EquityJob {
  if (board.length < 3 || board.length > 5) throw new Error("exact equity needs a flop, turn or river");
  const rest = remainingCards([...hole, ...board]);
  const outs = runouts(rest, 5 - board.length);
  const hero = new Int32Array(7);
  const opp = new Int32Array(7);
  let w = 0;
  let t = 0;
  let l = 0;
  let idx = 0;
  const avail = new Uint8Array(52);
  return {
    step(budget: number) {
      while (idx < outs.length && budget > 0) {
        const ro = outs[idx++];
        const full = board.concat(ro);
        for (let k = 0; k < 5; k++) hero[k] = opp[k] = full[k];
        hero[5] = hole[0];
        hero[6] = hole[1];
        const hs = evaluate(hero, 7);
        avail.fill(0);
        for (const c of rest) avail[c] = 1;
        for (const c of ro) avail[c] = 0;
        const left: Card[] = [];
        for (const c of rest) if (avail[c]) left.push(c);
        for (let i = 0; i < left.length; i++) {
          opp[5] = left[i];
          for (let j = i + 1; j < left.length; j++) {
            opp[6] = left[j];
            const os = evaluate(opp, 7);
            if (hs > os) w++;
            else if (hs < os) l++;
            else t++;
          }
        }
        budget -= 1 + (left.length * (left.length - 1)) / 2;
      }
      return idx >= outs.length;
    },
    result() {
      const n = w + t + l;
      return { win: w / n, tie: t / n, lose: l / n, equity: (w + t / 2) / n, cases: n };
    },
    progress() {
      return idx / outs.length;
    },
  };
}

export function exactEquity(hole: [Card, Card], board: Card[]): Equity {
  const job = equityJob(hole, board);
  while (!job.step(1e9));
  return job.result();
}

/** Quick sampled estimate. Only the computer players use this, never the coach. */
export function sampledEquity(hole: [Card, Card], board: Card[], trials: number, rand: () => number = Math.random): number {
  const rest = remainingCards([...hole, ...board]);
  const need = 5 - board.length;
  const hero = new Int32Array(7);
  const opp = new Int32Array(7);
  let score = 0;
  const pool = rest.slice();
  for (let n = 0; n < trials; n++) {
    // partial Fisher-Yates: draw need + 2 cards
    for (let k = 0; k < need + 2; k++) {
      const j = k + Math.floor(rand() * (pool.length - k));
      [pool[k], pool[j]] = [pool[j], pool[k]];
    }
    for (let k = 0; k < board.length; k++) hero[k] = opp[k] = board[k];
    for (let k = 0; k < need; k++) hero[board.length + k] = opp[board.length + k] = pool[k];
    hero[5] = hole[0];
    hero[6] = hole[1];
    opp[5] = pool[need];
    opp[6] = pool[need + 1];
    const a = evaluate(hero, 7);
    const b = evaluate(opp, 7);
    score += a > b ? 1 : a === b ? 0.5 : 0;
  }
  return score / trials;
}
