// Plays many hands with computer players in every seat (including yours) and checks the rules engine:
// chips are conserved, stacks never go negative, the button moves one seat each hand, every hand ends,
// the blinds go to the right seats, and the coach's book play is always a legal move.
import { botAction } from "../src/bots";
import { SEATS, START_STACK, Table, act, chipsOnTable, legal, newTable, positionOf, spotFor, startHand } from "../src/game";

const HANDS = Number(process.argv[2] ?? 100000);
let t: Table = newTable();
let fails = 0;
const fail = (msg: string) => {
  if (fails++ < 10) console.log("FAIL:", msg);
};
let showdowns = 0;
let sidePotHands = 0;
let actions = 0;
let spots = 0;
const t0 = Date.now();

for (let h = 0; h < HANDS; h++) {
  const prevButton = t.button;
  t = startHand(t);
  if (t.button !== (prevButton + 1) % SEATS) fail(`button moved from ${prevButton} to ${t.button}`);
  const sb = t.players[(t.button + 1) % SEATS];
  const bb = t.players[(t.button + 2) % SEATS];
  if (sb.total !== Math.min(1, t.startStacks[(t.button + 1) % SEATS]) || bb.total !== Math.min(2, t.startStacks[(t.button + 2) % SEATS]))
    fail(`blinds wrong on hand ${t.hand}`);
  if (positionOf(t.button, t.button) !== "BTN") fail("position labels");
  let guard = 0;
  while (t.phase === "betting") {
    if (++guard > 200) {
      fail(`hand ${t.hand} did not finish`);
      break;
    }
    const seat = t.toAct;
    if (seat === 0 && h % 10 === 0) {
      // check the coach on a sample of hands
      const s = spotFor(t, 0)!;
      spots++;
      const L = legal(t, 0);
      if (s.book.move === "raise" && !L.canRaise) fail("book says raise when raising is not allowed");
      if (s.book.move === "fold" && L.canCheck) fail("book says fold when checking is free");
    }
    const before = chipsOnTable(t);
    const next = act(t, seat, botAction(t, seat));
    if (next === t) {
      fail(`illegal bot action at hand ${t.hand}`);
      break;
    }
    t = next;
    actions++;
    const after = t.phase === "done" ? t.players.reduce((a, p) => a + p.stack, 0) : chipsOnTable(t);
    if (after !== before) fail(`chips changed during hand ${t.hand}`);
  }
  const total = t.players.reduce((a, p) => a + p.stack, 0);
  if (total !== SEATS * START_STACK + t.rebuys) fail(`chips not conserved after hand ${t.hand}: ${total} vs ${SEATS * START_STACK + t.rebuys}`);
  if (t.players.some((p) => p.stack < 0)) fail(`negative stack on hand ${t.hand}`);
  if (t.showdown) showdowns++;
  const totals = new Set(t.players.filter((p) => !p.folded).map((p) => p.total));
  if (t.showdown && totals.size > 1) sidePotHands++;
}

const secs = (Date.now() - t0) / 1000;
console.log(`${HANDS} hands, ${actions} actions in ${secs.toFixed(1)}s`);
console.log(`showdowns ${showdowns}, hands with side pots ${sidePotHands}, net chips added by top-ups ${t.rebuys}, coach spots checked ${spots}`);
console.log(`final stacks: ${t.players.map((p) => `${p.name} ${p.stack}`).join(", ")}`);
console.log(fails ? `${fails} FAILURE(S)` : "All rules checks passed.");
if (fails) process.exit(1);
