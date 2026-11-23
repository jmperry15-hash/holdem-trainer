import React from "react";
import { Card, isRed, rankLabel, rankOf, SUITS, suitOf } from "../engine/cards";

const SUIT_NAME = ["spades", "hearts", "diamonds", "clubs"];
const RANK_WORD = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king", "ace"];

/** A playing card. `w` is the width in px; small cards use a simple centered layout. */
export function CardView({ card, w, hidden = false, delay = 0, dim = false }: { card: Card | null; w: number; hidden?: boolean; delay?: number; dim?: boolean }) {
  const down = hidden || card === null;
  const label = down ? "Face-down card" : `${RANK_WORD[rankOf(card!)]} of ${SUIT_NAME[suitOf(card!)]}`;
  const compact = w < 46;
  const red = card !== null && isRed(card);
  const r = card !== null ? rankLabel(card) : "";
  const s = card !== null ? SUITS[suitOf(card)] : "";
  return (
    <div
      className={`card deal ${down ? "hidden-face" : ""} ${dim ? "opacity-40" : ""}`}
      style={{ ["--w" as string]: `${w}px`, animationDelay: `${delay}ms` }}
      role="img"
      aria-label={label}
    >
      <div className="card-inner">
        <div className={`card-face ${red ? "red" : ""}`}>
          {compact ? (
            <div className="compact-face">
              <span>{r}</span>
              <span className="s">{s}</span>
            </div>
          ) : (
            <>
              <div className="corner tl">
                <span>{r}</span>
                <span className="s">{s}</span>
              </div>
              <div className="pip">{s}</div>
              <div className="corner br">
                <span>{r}</span>
                <span className="s">{s}</span>
              </div>
            </>
          )}
        </div>
        <div className="card-back" />
      </div>
    </div>
  );
}

/** Inline text cards for review lists, e.g. A♠ K♦. */
export function MiniCards({ cards }: { cards: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {cards.map((c, i) => {
        const red = c.includes("♥") || c.includes("♦");
        return (
          <span key={i} className={`inline-grid h-6 min-w-[1.6rem] place-items-center rounded-[3px] bg-ivory px-0.5 font-sans text-[0.72rem] font-bold leading-none tracking-tighter shadow ${red ? "text-oxblood" : "text-ink"}`}>
            {c}
          </span>
        );
      })}
    </span>
  );
}
