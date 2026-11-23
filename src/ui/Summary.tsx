import React from "react";
import { MOVE_LABEL, moveText } from "../engine/strategy";
import { Decision } from "../game";
import { Session, STREET_LIST, summarize } from "../store";
import { MiniCards } from "./CardView";

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div
      className="gutter fixed inset-0 z-40 overflow-y-auto bg-black/70 backdrop-blur-sm"
      style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))", paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fade-up mx-auto my-4 w-full ${wide ? "max-w-5xl" : "max-w-3xl"} rounded-2xl border border-line bg-bg p-4 shadow-2xl sm:p-7`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl text-brasssoft sm:text-3xl">{title}</h2>
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-brass hover:text-ivory">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "brass" }) {
  const c = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "brass" ? "text-brass" : "text-ivory";
  return (
    <div className="min-w-0 rounded-xl border border-line bg-panel px-4 py-3">
      <div className="label">{label}</div>
      <div className={`mt-0.5 font-mono text-2xl tnum ${c}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function SessionSummaryView({ session, onNew }: { session: Session; onNew: () => void }) {
  const s = summarize(session);
  const acc = s.decisions ? s.correct / s.decisions : null;
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Correct" value={acc === null ? "—" : pct(acc)} tone="good" sub={`${s.correct} of ${s.decisions}`} />
        <Tile label="Mistakes" value={acc === null ? "—" : pct(1 - acc)} tone="bad" sub={`${s.decisions - s.correct} decisions`} />
        <Tile label="Hands" value={String(s.hands)} sub={`${s.decisions} decisions`} />
        <Tile label="Net chips" value={signed(s.net)} tone={s.net >= 0 ? "good" : "bad"} sub="luck matters short-term" />
      </div>

      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="label mb-3">Accuracy by street</div>
        <div className="grid gap-2.5">
          {STREET_LIST.map((k) => {
            const [c, t] = s.byStreet[k];
            return <Bar key={k} label={cap(k)} c={c} t={t} />;
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <span className="label">Missed book play</span>
          {(["fold", "call", "raise"] as const).map((m) => (
            <span key={m}>
              {MOVE_LABEL[m]} <span className="font-mono text-ivory">{s.wrongBook[m]}</span>
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="label mb-2">Review of each mistake</div>
        {s.mistakes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{s.decisions ? "No mistakes. Every decision matched the book." : "No decisions yet."}</p>
        ) : (
          <div className="grid gap-2">
            {s.mistakes.map((d, i) => (
              <MistakeRow key={i} d={d} />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={onNew} className="rounded-xl bg-brass px-6 py-3 font-display text-lg tracking-wide text-ink hover:bg-brasssoft">
          Start a new session
        </button>
      </div>
    </div>
  );
}

export function Bar({ label, c, t }: { label: string; c: number; t: number }) {
  const a = t ? c / t : 0;
  return (
    <div className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <div className="h-2.5 rounded-full bg-line/60">
        <div className="h-full rounded-full bg-good" style={{ width: `${a * 100}%` }} />
      </div>
      <span className="text-right font-mono text-xs tnum">
        {t ? pct(a, 0) : "—"} <span className="text-muted">({t})</span>
      </span>
    </div>
  );
}

export function MistakeRow({ d }: { d: Decision }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-xs text-muted">Hand {d.hand}</span>
        <MiniCards cards={d.cards} />
        {d.board.length > 0 && (
          <>
            <span className="text-xs text-muted">board</span>
            <MiniCards cards={d.board} />
          </>
        )}
      </div>
      <div className="mt-2 text-xs text-muted">
        {cap(d.street)} · {d.position} · {d.situation}
        {d.toCall > 0 && ` · ${d.toCall} to call into ${d.pot}`}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4">
        <span>
          You: <span className="text-bad">{moveText(d.choice, d.toCall)}</span>
        </span>
        <span>
          Book: <span className="text-good">{moveText(d.book, d.toCall)}</span>
        </span>
        {d.equity !== null && (
          <span className="font-mono text-xs text-muted">
            equity {pct(d.equity)}
            {d.toCall > 0 && ` · needed ${pct(d.potOdds)}`}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-ivory/80">{d.reason}</p>
    </div>
  );
}
