// 1. Exact equity (full enumeration) agrees with a large independent random sample.
// 2. Side pots and split pots pay the right players.
import { cardFromLabel as c, Card } from "../src/engine/cards";
import { exactEquity, sampledEquity } from "../src/engine/equity";
import { Table, act, newTable } from "../src/game";

let fails = 0;

// simple seeded RNG so the run is repeatable
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

const spots: [string, string][] = [
  ["A♥ K♦", "K♠ 9♥ 4♦"],
  ["7♣ 6♣", "8♣ 5♦ 2♣"],
  ["2♦ 2♠", "A♣ K♥ Q♦ J♠"],
  ["Q♥ J♥", "10♥ 9♠ 2♥ 3♣ K♦"],
  ["A♠ 5♠", "A♦ A♣ 5♥"],
];
const N = 400000;
console.log(`Exact equity vs one random hand, against ${N.toLocaleString()} random samples`);
for (const [h, b] of spots) {
  const hole = h.split(" ").map(c) as [Card, Card];
  const board = b.split(" ").map(c);
  const ex = exactEquity(hole, board);
  const mc = sampledEquity(hole, board, N, rand);
  const se = Math.sqrt((mc * (1 - mc)) / N);
  const ok = Math.abs(ex.equity - mc) < 4 * se + 1e-9;
  if (!ok) fails++;
  console.log(
    `  ${h.padEnd(6)} on ${b.padEnd(16)} exact ${(ex.equity * 100).toFixed(3)}%  sampled ${(mc * 100).toFixed(3)}% ±${(se * 200).toFixed(3)}  ${ok ? "ok" : "MISMATCH"}`,
  );
}

// ------------------------------------------------------------- side pots
function riverTable(holes: string[], board: string, totals: number[], allIn: boolean[], folded: boolean[], toAct: number): Table {
  const t = newTable();
  t.phase = "betting";
  t.street = "river";
  t.button = 4;
  t.board = board.split(" ").map(c);
  t.players.forEach((p, i) => {
    p.hole = holes[i] ? holes[i].split(" ").map(c) : [];
    p.total = totals[i];
    p.stack = allIn[i] ? 0 : 100;
    p.allIn = allIn[i];
    p.folded = folded[i];
  });
  t.startStacks = t.players.map((p) => p.stack + p.total);
  t.toAct = toAct;
  return t;
}

function expect(label: string, t: Table, want: number[]) {
  const got = t.players.map((p, i) => p.stack - (t.startStacks[i] - p.total));
  const ok = t.phase === "done" && got.every((g, i) => g === want[i]);
  if (!ok) fails++;
  console.log(`  ${label}: won ${got.join(", ")} ${ok ? "ok" : `WRONG, expected ${want.join(", ")}`}`);
}

console.log("\nPots");
// You (all in for 50) have the best hand, Ava (all in for 100) second, Ben worst; Cal folded after putting in 10.
let t = riverTable(
  ["A♠ A♦", "K♠ K♦", "Q♠ J♦", "7♣ 2♦", ""],
  "A♥ K♥ 8♣ 4♦ 3♠",
  [50, 100, 100, 10, 0],
  [true, true, false, false, false],
  [false, false, false, true, true],
  2,
);
t = act(t, 2, { type: "check" });
expect("main pot 160 to you, side pot 100 to Ava", t, [160, 100, 0, 0, 0]);

// A split pot with an odd chip: the first winner left of the button (seat 0) gets it.
t = riverTable(["A♠ 2♦", "A♦ 3♣", "7♣ 2♣", "", ""], "K♥ Q♥ J♣ 10♦ 4♠", [21, 21, 21, 0, 0], [false, false, false, false, false], [false, false, false, true, true], 2);
t.players[2].total = 21;
t.players.forEach((p) => (p.acted = true));
t.players[2].acted = false;
t = act(t, 2, { type: "check" });
expect("63 split between two straights, odd chip to seat 0", t, [32, 31, 0, 0, 0]);

console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nAll equity and pot checks passed.");
if (fails) process.exit(1);
