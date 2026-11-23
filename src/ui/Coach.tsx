import React from "react";
import { cardLabel } from "../engine/cards";
import { moveText } from "../engine/strategy";
import { Decision, Spot } from "../game";
import { pct } from "./Summary";

/** Learn mode: the numbers behind the book play for your current decision. */
export function CoachSpot({ spot }: { spot: Spot }) {
  return (
    <div className="fade-up rounded-xl border border-line bg-panel p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">Coach</span>
        <span className="text-xs text-muted">
          {spot.position} · {spot.cls} · {spot.street}
        </span>
      </div>
      {spot.handName && <div className="mt-1.5 font-semibold">{spot.handName}</div>}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {spot.equity ? <Stat label="Your equity" value={pct(spot.equity.equity)} sub="vs 1 random hand" /> : <Stat label="Your hand" value={spot.cls} sub={`${spot.position}, from the chart`} />}
        <Stat label="Pot odds" value={spot.toCall > 0 ? pct(spot.potOdds) : "—"} sub={spot.toCall > 0 ? `${spot.toCall} to win ${spot.pot + spot.toCall}` : "nothing to call"} />
        <Stat label="Book play" value={moveText(spot.book.move, spot.toCall)} tone />
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-ivory/85">{spot.book.reason}</p>
      <p className="mt-1.5 text-[0.7rem] leading-snug text-muted">
        {spot.equity
          ? `Exact: every one of ${spot.equity.cases.toLocaleString()} opponent hand and board combinations against one random hand. Win ${pct(spot.equity.win)}, tie ${pct(spot.equity.tie)}. Real opponents who bet usually hold better than random.`
          : "Preflop plays come from the 5-handed chart (Chart button)."}
      </p>
    </div>
  );
}

/** Feedback on the decision you just made. */
export function Feedback({ d }: { d: Decision }) {
  return (
    <div className={`fade-up rounded-xl border p-3.5 ${d.correct ? "border-good/50 bg-good/10" : "border-bad/50 bg-bad/10"}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`font-semibold ${d.correct ? "text-good" : "text-bad"}`}>{d.correct ? "Book play" : "Not the book play"}</span>
        <span className="text-xs text-muted">
          You chose {moveText(d.choice, d.toCall).toLowerCase()}
          {!d.correct && `; the book says ${moveText(d.book, d.toCall).toLowerCase()}`}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ivory/85">{d.reason}</p>
      {d.equity !== null && (
        <p className="mt-1 font-mono text-xs text-muted">
          equity {pct(d.equity)}
          {d.toCall > 0 && ` · needed ${pct(d.potOdds)}`}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone = false }: { label: string; value: string; sub?: string; tone?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.68rem] text-muted">{label}</div>
      <div className={`font-mono text-[0.95rem] leading-tight tnum ${tone ? "text-good" : ""}`}>{value}</div>
      {sub && <div className="text-[0.65rem] text-muted">{sub}</div>}
    </div>
  );
}

export const cardsText = (cs: number[]) => cs.map(cardLabel).join(" ");
