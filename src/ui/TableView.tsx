import React from "react";
import { Table, positionOf, potTotal } from "../game";
import { CardView } from "./CardView";

// Seat placement around the oval, clockwise from you at the bottom: you, left, top-left, top-right, right.
const SPOTS: React.CSSProperties[] = [
  { left: "50%", bottom: "6px", transform: "translateX(-50%)" },
  { left: "2%", top: "61%", transform: "translateY(-58%)" },
  { left: "20%", top: "4px", transform: "translateX(-50%)" },
  { left: "80%", top: "4px", transform: "translateX(-50%)" },
  { right: "2%", top: "61%", transform: "translateY(-58%)" },
];
// Where each seat's bet sits, toward the middle of the table.
const BETS: React.CSSProperties[] = [
  { left: "calc(50% + 68px)", bottom: "96px" },
  { left: "26%", top: "57%" },
  { left: "29%", top: "28%" },
  { right: "29%", top: "28%" },
  { right: "26%", top: "57%" },
];

export function TableView({ t, mobile }: { t: Table; mobile: boolean }) {
  const pot = potTotal(t);
  const done = t.phase === "done";
  const boardW = mobile ? 40 : 58;
  const botW = mobile ? 24 : 34;
  const youW = mobile ? 48 : 62;
  const winners = new Set(t.awards.map((a) => a.seat));
  return (
    <div className="felt relative mx-1 overflow-visible rounded-[150px/110px] sm:mx-0" style={{ height: mobile ? 356 : 440 }}>
      {/* board and pot */}
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="flex justify-center gap-1" aria-label="Board">
          {Array.from({ length: 5 }, (_, i) =>
            t.board[i] !== undefined ? (
              <CardView key={`${t.hand}-${i}`} card={t.board[i]} w={boardW} delay={i < 3 ? i * 70 : 0} />
            ) : (
              <div key={i} className="rounded-[4px] border border-dashed border-brass/25" style={{ width: boardW, height: boardW * 1.4 }} />
            ),
          )}
        </div>
        <div className="mt-2 font-mono text-sm text-brasssoft tnum">
          {t.phase === "idle" ? "Deal to start" : `Pot ${pot}`}
        </div>
      </div>

      {t.players.map((p, i) => {
        const pos = t.phase === "idle" ? null : positionOf(i, t.button);
        const turn = t.phase === "betting" && t.toAct === i;
        const showCards = p.human || (done && t.showdown && !p.folded);
        const award = t.awards.find((a) => a.seat === i);
        return (
          <React.Fragment key={i}>
            <div className="absolute z-10" style={SPOTS[i]}>
              <div
                className={`flex flex-col items-center rounded-xl px-1.5 py-1 text-center transition ${turn ? "turn bg-black/40" : "bg-black/25"} ${p.folded ? "opacity-50" : ""} ${done && winners.has(i) ? "ring-2 ring-good" : ""}`}
                style={{ minWidth: p.human ? 120 : mobile ? 64 : 84 }}
                aria-label={`${p.name}${pos ? `, ${pos}` : ""}, ${p.stack} chips${p.folded ? ", folded" : ""}`}
              >
                {!p.human && (
                  <div className="mb-1 flex gap-0.5">
                    {p.hole.length === 2 && !p.folded ? (
                      p.hole.map((c, k) => <CardView key={`${t.hand}-${k}`} card={showCards ? c : null} w={botW} delay={k * 60} />)
                    ) : (
                      <div style={{ height: botW * 1.4 }} />
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1 text-[0.78rem] font-semibold leading-tight">
                  {p.name}
                  {pos && <PosBadge pos={pos} />}
                  {p.human && <span className="ml-1 font-mono text-[0.75rem] font-normal text-brasssoft tnum">{p.stack}</span>}
                </div>
                {!p.human && <div className="font-mono text-[0.75rem] text-brasssoft tnum">{p.stack}</div>}
                <div className="min-h-[1rem] text-[0.7rem] leading-tight text-ivory/75">
                  {done && award ? <span className="text-good">+{award.amount}</span> : p.last ?? ""}
                </div>
                {p.human && (
                  <div className="mt-0.5 flex gap-1">
                    {p.hole.map((c, k) => (
                      <CardView key={`${t.hand}-${k}`} card={c} w={youW} delay={k * 60} dim={p.folded} />
                    ))}
                  </div>
                )}
              </div>
            </div>
            {p.bet > 0 && !done && (
              <div className="absolute z-0 flex items-center gap-1 font-mono text-[0.72rem] text-ivory tnum" style={BETS[i]}>
                <span className="chip inline-block h-3.5 w-3.5" style={{ ["--chip" as string]: "rgb(var(--oxblood))" }} />
                {p.bet}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function PosBadge({ pos }: { pos: string }) {
  if (pos === "BTN")
    return (
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-ivory text-[0.62rem] font-bold text-ink" title="Dealer button">
        D
      </span>
    );
  return <span className="rounded bg-black/40 px-1 text-[0.6rem] font-bold tracking-wide text-brasssoft">{pos}</span>;
}
