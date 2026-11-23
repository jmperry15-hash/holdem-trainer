// Checks the hand evaluator against the known counts of every 5-card and 7-card poker hand.
import { evaluate, CATEGORY } from "../src/engine/evaluate";
import { exactEquity } from "../src/engine/equity";
import { cardFromLabel as c } from "../src/engine/cards";

const FIVE = [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40];
const SEVEN = [23294460, 58627800, 31433400, 6461620, 6180020, 4047644, 3473184, 224848, 41584];

let fail = 0;
function check(label: string, got: number[], want: number[]) {
  console.log(`\n${label}`);
  for (let i = 0; i < 9; i++) {
    const ok = got[i] === want[i];
    if (!ok) fail++;
    console.log(`  ${CATEGORY[i].padEnd(16)} ${String(got[i]).padStart(10)}  ${ok ? "ok" : `WRONG, expected ${want[i]}`}`);
  }
}

// every 5-card hand
const five = new Array(9).fill(0);
const distinct = new Set<number>();
const h = new Int32Array(7);
for (let a = 0; a < 52; a++)
  for (let b = a + 1; b < 52; b++)
    for (let d = b + 1; d < 52; d++)
      for (let e = d + 1; e < 52; e++)
        for (let f = e + 1; f < 52; f++) {
          h[0] = a; h[1] = b; h[2] = d; h[3] = e; h[4] = f;
          const s = evaluate(h, 5);
          five[s >> 20]++;
          distinct.add(s);
        }
check("All 2,598,960 five-card hands", five, FIVE);
console.log(`  distinct hand ranks: ${distinct.size} ${distinct.size === 7462 ? "ok" : "WRONG, expected 7462"}`);
if (distinct.size !== 7462) fail++;

// every 7-card hand (best five of seven)
const t0 = Date.now();
const seven = new Array(9).fill(0);
for (let a = 0; a < 52; a++)
  for (let b = a + 1; b < 52; b++)
    for (let d = b + 1; d < 52; d++)
      for (let e = d + 1; e < 52; e++)
        for (let f = e + 1; f < 52; f++)
          for (let g = f + 1; g < 52; g++)
            for (let k = g + 1; k < 52; k++) {
              h[0] = a; h[1] = b; h[2] = d; h[3] = e; h[4] = f; h[5] = g; h[6] = k;
              seven[evaluate(h, 7) >> 20]++;
            }
check(`All 133,784,560 seven-card hands (${((Date.now() - t0) / 1000).toFixed(1)}s)`, seven, SEVEN);

// a few head-to-head orderings
const pairs: [string, string, number][] = [
  ["A♠ K♠ Q♠ J♠ 10♠", "9♥ 9♦ 9♣ 9♠ 2♥", 1],
  ["A♥ 2♦ 3♣ 4♠ 5♥", "2♥ 3♦ 4♣ 5♠ 6♥", -1], // wheel loses to six-high straight
  ["K♥ K♦ 9♣ 9♠ 2♥", "K♣ K♠ 9♥ 9♦ 3♥", -1], // kicker decides
  ["A♥ A♦ 5♣ 4♠ 3♥", "A♣ A♠ 5♥ 4♦ 3♦", 0],
];
console.log("\nHead to head");
for (const [x, y, want] of pairs) {
  const sx = evaluate(x.split(" ").map(c));
  const sy = evaluate(y.split(" ").map(c));
  const got = Math.sign(sx - sy);
  if (got !== want) fail++;
  console.log(`  ${x}  vs  ${y}: ${got === want ? "ok" : "WRONG"}`);
}

// exact equity timing on the flop (the slowest case the app runs)
const t1 = Date.now();
const eq = exactEquity([c("A♥"), c("K♦")], [c("K♠"), c("9♥"), c("4♦")]);
console.log(`\nExact flop equity A♥K♦ on K♠9♥4♦ vs one random hand: ${(eq.equity * 100).toFixed(2)}% over ${eq.cases} cases in ${Date.now() - t1} ms`);

console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nAll evaluator checks passed.");
if (fail) process.exit(1);
