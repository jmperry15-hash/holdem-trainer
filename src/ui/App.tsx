import React from "react";
import { botAction } from "../bots";
import { MOVE_LABEL, Move } from "../engine/strategy";
import { Action, Decision, Spot, Table, act, decisionFrom, handNet, legal, newTable, potTotal, spotFor, startHand } from "../game";
import { DEFAULT_SETTINGS, Mode, Session, SessionSummary, Settings, load, newSession, save, summarize, upsertHistory } from "../store";
import { ChartView } from "./ChartView";
import { CoachSpot, Feedback } from "./Coach";
import { Progress } from "./Progress";
import { Modal, SessionSummaryView, pct, signed } from "./Summary";
import { TableView } from "./TableView";

// ---------------------------------------------------------------- state

interface AppState {
  table: Table;
  session: Session;
  history: SessionSummary[];
  settings: Settings;
  modal: null | "chart" | "progress" | "summary";
  toast: string | null;
  feedback: Decision | null;
}

type Msg =
  | { t: "deal" }
  | { t: "you"; a: Action }
  | { t: "bot" }
  | { t: "mode"; m: Mode }
  | { t: "finish" }
  | { t: "newSession" }
  | { t: "modal"; m: AppState["modal"] }
  | { t: "hints" }
  | { t: "speed" }
  | { t: "clearHistory" }
  | { t: "toast"; s: string | null };

function withTable(prev: AppState, table: Table): AppState {
  let session = prev.session;
  if (prev.table.phase !== "done" && table.phase === "done") session = { ...session, hands: session.hands + 1, net: session.net + handNet(table)[0] };
  return { ...prev, table, session };
}

function reducer(s: AppState, m: Msg): AppState {
  switch (m.t) {
    case "deal": {
      if (s.table.phase === "betting") return s;
      const rebuy = s.table.players[0].stack === 0;
      const next = withTable(s, startHand(s.table));
      return { ...next, feedback: null, toast: rebuy ? "You were out of chips, so you rebought 200." : s.toast };
    }
    case "you": {
      const spot = spotFor(s.table, 0);
      if (!spot) return s;
      const table = act(s.table, 0, m.a);
      if (table === s.table) return s;
      const d = decisionFrom(spot, s.table, m.a);
      const next = withTable(s, table);
      return { ...next, session: { ...next.session, decisions: [...next.session.decisions, d] }, feedback: d };
    }
    case "bot": {
      const seat = s.table.toAct;
      if (s.table.phase !== "betting" || seat <= 0) return s;
      return withTable(s, act(s.table, seat, botAction(s.table, seat)));
    }
    case "mode": {
      if (m.m === s.session.mode) return s;
      if (s.session.decisions.length > 0 || s.session.hands > 0)
        return {
          ...s,
          history: upsertHistory(s.history, summarize(s.session)),
          session: newSession(m.m),
          feedback: null,
          modal: null,
          toast: `${s.session.mode === "learn" ? "Learn" : "Test"} session saved to Progress. New ${m.m} session started.`,
        };
      return { ...s, session: { ...s.session, mode: m.m }, feedback: null, modal: null };
    }
    case "finish":
      return { ...s, history: upsertHistory(s.history, summarize(s.session)), modal: "summary" };
    case "newSession":
      return { ...s, session: newSession(s.session.mode), feedback: null, modal: null };
    case "modal":
      return { ...s, modal: m.m };
    case "hints":
      return { ...s, settings: { ...s.settings, hintsFirst: !s.settings.hintsFirst } };
    case "speed":
      return { ...s, settings: { ...s.settings, speed: s.settings.speed === "fast" ? "normal" : "fast" } };
    case "clearHistory":
      return { ...s, history: [] };
    case "toast":
      return { ...s, toast: m.s };
  }
}

function init(hot?: unknown): AppState {
  const h = hot as Partial<AppState> | undefined;
  if (h && h.table && h.session) return { ...(h as AppState), modal: null, toast: null };
  const p = load();
  return {
    table: p.table ?? newTable(),
    session: p.session ?? newSession("learn"),
    history: p.history ?? [],
    settings: p.settings ?? DEFAULT_SETTINGS,
    modal: null,
    toast: null,
    feedback: null,
  };
}

function useMobile() {
  const q = "(max-width: 639px)";
  const [m, setM] = React.useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  React.useEffect(() => {
    const mq = matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return m;
}

// ---------------------------------------------------------------- app

export function App({ hot }: { hot?: unknown }) {
  const [s, dispatch] = React.useReducer(reducer, hot, init);
  const mobile = useMobile();
  const ref = React.useRef(s);
  ref.current = s;
  const { table, session, settings } = s;
  const learn = session.mode === "learn";
  const yourTurn = table.phase === "betting" && table.toAct === 0;
  const spot = yourTurn ? spotFor(table, 0) : null;
  const showHints = learn && settings.hintsFirst;

  React.useEffect(() => {
    window.claude?.hot?.snapshot?.(() => ref.current);
  }, []);

  // save everything except the open modal and toast
  React.useEffect(() => {
    save({ v: 1, table: s.table, settings: s.settings, session: s.session, history: s.history });
  }, [s.table, s.settings, s.session, s.history]);

  // computer players act after a short pause
  React.useEffect(() => {
    if (table.phase !== "betting" || table.toAct <= 0) return;
    const youOut = table.players[0].folded;
    const ms = settings.speed === "fast" || youOut ? 380 : 800;
    const id = setTimeout(() => dispatch({ t: "bot" }), ms);
    return () => clearTimeout(id);
  }, [table, settings.speed]);

  React.useEffect(() => {
    if (!s.toast) return;
    const id = setTimeout(() => dispatch({ t: "toast", s: null }), 3200);
    return () => clearTimeout(id);
  }, [s.toast]);

  const sum = React.useMemo(() => summarize(session), [session]);

  return (
    <div className="min-h-full pb-[env(safe-area-inset-bottom)]">
      <header className="gutter border-b border-line/70" style={{ paddingTop: "max(10px, env(safe-area-inset-top, 0px))", paddingBottom: "10px" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-[1.35rem] tracking-wide text-brasssoft sm:text-[1.7rem]">By the Book</h1>
            <span className="font-display text-sm text-ivory/70 sm:text-base">Hold'em</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div role="tablist" aria-label="Mode" className="flex rounded-xl border border-line bg-panel p-0.5">
              {(["learn", "test"] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={session.mode === m}
                  onClick={() => dispatch({ t: "mode", m })}
                  className={`rounded-[10px] px-3 py-1.5 text-sm font-semibold ${session.mode === m ? "bg-brass text-ink" : "text-muted hover:text-ivory"}`}
                >
                  {m === "learn" ? "Learn" : "Test"}
                </button>
              ))}
            </div>
            <button
              onClick={() => dispatch({ t: "modal", m: "chart" })}
              disabled={!learn}
              title={learn ? "Preflop chart" : "The chart is off in Test mode"}
              className="rounded-xl border border-line px-2.5 py-1.5 text-sm hover:border-brass disabled:cursor-not-allowed disabled:opacity-40"
            >
              Chart
            </button>
            <button onClick={() => dispatch({ t: "modal", m: "progress" })} className="rounded-xl border border-line px-2.5 py-1.5 text-sm hover:border-brass">
              Progress
            </button>
          </div>
        </div>
      </header>

      <div className="gutter border-b border-line/50" style={{ paddingBlock: "7px" }}>
        <div className="mx-auto flex max-w-6xl items-center gap-x-4 text-[0.8rem] tnum">
          <Stat label="Stack" value={String(table.players[0].stack)} />
          <Stat label="Hand" value={String(table.hand)} />
          <Stat label={learn ? "Correct" : "Graded"} value={learn ? (sum.decisions ? pct(sum.correct / sum.decisions, 0) : "—") : String(sum.decisions)} />
          <button
            onClick={() => dispatch({ t: "finish" })}
            className="ml-auto rounded-lg border border-brass/70 bg-brass/10 px-2.5 py-1 text-xs font-semibold text-brasssoft hover:bg-brass/20"
          >
            Finish<span className="hidden sm:inline"> session</span>
          </button>
        </div>
      </div>

      <main className="gutter" style={{ paddingBlock: mobile ? "14px 28px" : "22px 40px" }}>
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
          <div className="min-w-0">
            <TableView t={table} mobile={mobile} />
            <div className="mt-3">
              {yourTurn && spot ? (
                <ActionBar key={`${table.hand}-${table.street}-${table.currentBet}`} t={table} spot={spot} hint={showHints ? spot.book.move : null} onAct={(a) => dispatch({ t: "you", a })} />
              ) : (
                <Waiting t={table} onDeal={() => dispatch({ t: "deal" })} />
              )}
            </div>
            <div className="mt-2 hidden flex-wrap items-center justify-between gap-2 text-xs text-muted sm:flex">
              <span>
                Keys: <Kbd>F</Kbd> fold <Kbd>C</Kbd> check or call <Kbd>R</Kbd> bet or raise <Kbd>N</Kbd> next hand
              </span>
              <button onClick={() => dispatch({ t: "speed" })} className="rounded-md border border-line px-2 py-1 hover:border-brass">
                Speed: {settings.speed === "fast" ? "fast" : "normal"}
              </button>
            </div>
          </div>

          <aside className="grid min-w-0 content-start gap-3">
            {learn ? (
              <>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-sm">
                  <span>Show the book play before I act</span>
                  <input type="checkbox" checked={settings.hintsFirst} onChange={() => dispatch({ t: "hints" })} className="h-4 w-4 accent-[rgb(var(--brass))]" />
                </label>
                {spot && showHints && <CoachSpot spot={spot} />}
                {s.feedback && (!spot || !showHints) && <Feedback d={s.feedback} />}
                {!spot && !s.feedback && (
                  <p className="rounded-xl border border-dashed border-line p-3.5 text-sm leading-relaxed text-muted">
                    You're seat 1 of 5 against Ava (tight), Ben (loose), Cal (aggressive) and Dee (steady). Blinds 1/2, 200-chip stacks, and the dealer button moves one seat clockwise every hand. The coach appears
                    when it's your turn.
                  </p>
                )}
                {spot && showHints && s.feedback && s.feedback.hand === table.hand && <Feedback d={s.feedback} />}
              </>
            ) : (
              <div className="rounded-xl border border-line bg-panel p-4 text-sm leading-relaxed text-ivory/85">
                <div className="font-display text-lg text-brasssoft">Test in progress</div>
                No hints and no chart. Every decision is graded silently. Press <span className="font-semibold text-brasssoft">Finish session</span> for your score and a review of each mistake.
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-line px-2 py-2">
                    <div className="label">Hands</div>
                    <div className="font-mono text-lg">{session.hands}</div>
                  </div>
                  <div className="rounded-lg border border-line px-2 py-2">
                    <div className="label">Decisions</div>
                    <div className="font-mono text-lg">{session.decisions.length}</div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {s.modal === "chart" && (
        <Modal title="Preflop chart" onClose={() => dispatch({ t: "modal", m: null })}>
          <ChartView initial={spot && spot.raises > 0 ? (spot.raises === 1 ? "vs raise" : "vs re-raise") : spot && spot.position !== "BB" ? spot.position : undefined} />
        </Modal>
      )}
      {s.modal === "progress" && (
        <Modal title="Progress" wide onClose={() => dispatch({ t: "modal", m: null })}>
          <Progress history={s.history} current={sum} onClear={() => dispatch({ t: "clearHistory" })} />
        </Modal>
      )}
      {s.modal === "summary" && (
        <Modal title={`${learn ? "Learn" : "Test"} session`} onClose={() => dispatch({ t: "modal", m: null })}>
          <SessionSummaryView session={session} onNew={() => dispatch({ t: "newSession" })} />
        </Modal>
      )}
      {s.toast && (
        <div
          role="status"
          className="fade-up fixed left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-xl border border-brass/60 bg-panel px-4 py-2.5 text-center text-sm shadow-xl"
          style={{ bottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}
        >
          {s.toast}
        </div>
      )}
      <Keys s={s} spot={spot} dispatch={dispatch} />
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="label">{label}</span>
      <span className="font-mono text-ivory">{value}</span>
    </span>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => <kbd className="mx-0.5 rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[0.7rem] text-ivory">{children}</kbd>;

/** Preset raise sizes: raise to the current bet plus a fraction of the pot after calling. */
function presets(t: Table, spot: Spot) {
  const L = legal(t, 0);
  const pot = potTotal(t);
  const size = (f: number) => Math.max(L.minTo, Math.min(L.maxTo, Math.round(t.currentBet + f * (pot + L.toCall))));
  return [
    { label: "Min", to: L.minTo },
    { label: "½ pot", to: size(0.5) },
    { label: "Pot", to: size(1) },
    { label: "All in", to: L.maxTo },
  ].filter((p, i, a) => spot.canRaise && (i === 0 || p.to !== a[i - 1].to || p.label === "All in"));
}

function ActionBar({ t, spot, hint, onAct }: { t: Table; spot: Spot; hint: Move | null; onAct: (a: Action) => void }) {
  const L = legal(t, 0);
  const ps = presets(t, spot);
  const [to, setTo] = React.useState(() => ps.find((p) => p.label === "½ pot")?.to ?? L.minTo);
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== "range") return;
      const key = e.key.toLowerCase();
      if (key === "f") onAct({ type: "fold" });
      else if (key === "c") onAct(L.canCheck ? { type: "check" } : { type: "call" });
      else if (key === "r" && spot.canRaise) onAct({ type: "raise", to });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [L.canCheck, spot.canRaise, to, onAct]);
  const allIn = to >= L.maxTo;
  const raiseLabel = allIn ? `All in ${L.maxTo}` : t.currentBet === 0 ? `Bet ${to}` : `Raise to ${to}`;
  const callAllIn = !L.canCheck && L.toCall >= t.players[0].stack;
  return (
    <div className="grid gap-2.5">
      {spot.canRaise && (
        <div className="flex items-center gap-1.5">
          {ps.map((p) => (
            <button
              key={p.label}
              onClick={() => setTo(p.to)}
              className={`flex-1 rounded-lg border px-1 py-1.5 text-xs ${to === p.to ? "border-brass text-brasssoft" : "border-line text-muted hover:text-ivory"}`}
            >
              {p.label}
            </button>
          ))}
          {L.maxTo > L.minTo && (
            <input
              type="range"
              aria-label="Raise amount"
              min={L.minTo}
              max={L.maxTo}
              step={1}
              value={to}
              onChange={(e) => setTo(Number(e.target.value))}
              className="ml-1 w-[30%] min-w-0"
            />
          )}
        </div>
      )}
      <div className="grid grid-cols-[1fr_1fr_1.25fr] gap-2">
        <ActBtn label="Fold" book={hint === "fold"} onClick={() => onAct({ type: "fold" })} />
        <ActBtn
          label={L.canCheck ? "Check" : callAllIn ? `Call all in ${L.toCall}` : `Call ${L.toCall}`}
          book={hint === "call"}
          onClick={() => onAct(L.canCheck ? { type: "check" } : { type: "call" })}
        />
        <ActBtn label={spot.canRaise ? raiseLabel : "Can't raise"} book={hint === "raise"} primary disabled={!spot.canRaise} onClick={() => onAct({ type: "raise", to })} />
      </div>
    </div>
  );
}

function ActBtn({ label, onClick, book, primary = false, disabled = false }: { label: string; onClick: () => void; book: boolean; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative min-h-[50px] rounded-xl px-2 py-3 text-[0.95rem] font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-35 ${
        primary ? "bg-brass text-ink hover:bg-brasssoft" : "border border-line bg-panel hover:border-brass"
      } ${book ? "best" : ""}`}
    >
      {book && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-brass">Book play</span>
      )}
      {label}
    </button>
  );
}

function Waiting({ t, onDeal }: { t: Table; onDeal: () => void }) {
  if (t.phase === "betting") {
    const p = t.players[t.toAct];
    return (
      <div className="grid min-h-[92px] place-items-center rounded-xl border border-dashed border-line text-sm text-muted">
        {t.players[0].folded ? `You folded. ${p.name} to act…` : `${p.name} is thinking…`}
      </div>
    );
  }
  const net = t.phase === "done" ? handNet(t)[0] : 0;
  return (
    <div className="grid gap-2">
      {t.phase === "done" && (
        <div className="pop rounded-xl border border-line bg-panel px-3.5 py-2.5 text-sm">
          {t.awards.map((a) => (
            <div key={a.seat}>
              <span className={a.seat === 0 ? "font-semibold text-good" : ""}>{a.seat === 0 ? "You win" : `${t.players[a.seat].name} wins`}</span> {a.amount}
              {a.hand ? <span className="text-muted"> with {a.hand.charAt(0).toLowerCase() + a.hand.slice(1)}</span> : <span className="text-muted"> (everyone else folded)</span>}
            </div>
          ))}
          <div className="mt-1 font-mono text-xs text-muted">
            Your result this hand: <span className={net > 0 ? "text-good" : net < 0 ? "text-bad" : ""}>{signed(net)}</span>
          </div>
        </div>
      )}
      <button onClick={onDeal} className="min-h-[50px] rounded-xl bg-brass px-8 py-3 font-display text-lg tracking-wide text-ink shadow-lg hover:bg-brasssoft active:translate-y-px">
        {t.phase === "idle" ? "Deal first hand" : "Next hand"}
      </button>
    </div>
  );
}

function Keys({ s, spot, dispatch }: { s: AppState; spot: Spot | null; dispatch: React.Dispatch<Msg> }) {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (s.modal || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "n" && !spot && s.table.phase !== "betting") dispatch({ t: "deal" });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [s.modal, s.table.phase, spot, dispatch]);
  return null;
}

export { MOVE_LABEL };
