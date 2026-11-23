import React from "react";
import { RANKS } from "../engine/cards";
import { CALL_RAISE, CALL_RAISE_BB_EXTRA, CALL_RERAISE, FOUR_BET, OPEN, THREE_BET } from "../engine/strategy";

type Tab = "UTG" | "CO" | "BTN" | "SB" | "vs raise" | "vs re-raise";
const TABS: Tab[] = ["UTG", "CO", "BTN", "SB", "vs raise", "vs re-raise"];

function cellClass(tab: Tab, cls: string): string {
  if (tab === "vs raise") {
    if (THREE_BET.has(cls)) return "cell-raise";
    if (CALL_RAISE.has(cls)) return "cell-call";
    if (CALL_RAISE_BB_EXTRA.has(cls)) return "cell-bbcall";
    return "cell-fold";
  }
  if (tab === "vs re-raise") return FOUR_BET.has(cls) ? "cell-raise" : CALL_RERAISE.has(cls) ? "cell-call" : "cell-fold";
  return OPEN[tab].has(cls) ? "cell-raise" : "cell-fold";
}

export function ChartView({ initial }: { initial?: Tab }) {
  const [tab, setTab] = React.useState<Tab>(initial ?? "UTG");
  const order = [...RANKS].reverse(); // A K Q ... 2
  const count = (() => {
    let n = 0;
    for (let i = 0; i < 13; i++)
      for (let j = 0; j < 13; j++) {
        const cls = i === j ? order[i] + order[j] : i < j ? order[i] + order[j] + "s" : order[j] + order[i] + "o";
        if (cellClass(tab, cls) === "cell-raise") n += i === j ? 6 : i < j ? 4 : 12;
      }
    return n;
  })();
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed text-ivory/80">
        A simplified standard chart for a 5-handed table. It is not a proven optimum; no proven book exists for 5-handed no-limit hold'em. Suited hands are above the diagonal, offsuit below.
      </p>
      <div role="tablist" aria-label="Chart" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${tab === t ? "border-brass bg-brass/15 text-brasssoft" : "border-line text-muted hover:text-ivory"}`}
          >
            {t === "vs raise" || t === "vs re-raise" ? cap(t) : `${t} open`}
          </button>
        ))}
      </div>
      <div className="mx-auto grid w-full max-w-[560px] grid-cols-13 gap-[2px]" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
        {order.map((r1, i) =>
          order.map((r2, j) => {
            const cls = i === j ? r1 + r2 : i < j ? r1 + r2 + "s" : r2 + r1 + "o";
            return (
              <div key={cls} className={`grid aspect-square place-items-center rounded-[3px] font-mono text-[9px] leading-none sm:text-xs ${cellClass(tab, cls)}`} title={cls}>
                {cls.replace("T", "T")}
              </div>
            );
          }),
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <Legend c="cell-raise" t={tab === "vs raise" ? "3-bet" : tab === "vs re-raise" ? "Re-raise" : "Raise first in"} />
        {(tab === "vs raise" || tab === "vs re-raise") && <Legend c="cell-call" t="Call" />}
        {tab === "vs raise" && <Legend c="cell-bbcall" t="Call from the big blind only" />}
        <Legend c="cell-fold" t="Fold" />
        <span className="ml-auto font-mono">
          {tab === "vs raise" ? "3-bet" : tab === "vs re-raise" ? "re-raise" : "opens"} {((count / 1326) * 100).toFixed(1)}% of hands
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        After the flop there is no chart. The book play comes from your exact equity against one random hand: bet with 50% or more when checked to; facing a bet, fold below the pot odds, raise with 70% or more,
        otherwise call.
      </p>
    </div>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const Legend = ({ c, t }: { c: string; t: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`h-3 w-3 rounded-sm ${c}`} />
    {t}
  </span>
);
