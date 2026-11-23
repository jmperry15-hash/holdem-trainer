// Sessions, history and settings saved in this browser (localStorage).
import { Decision, Street, Table } from "./game";
import { Move, Position } from "./engine/strategy";

export type Mode = "learn" | "test";

export interface Session {
  id: string;
  mode: Mode;
  startedAt: number;
  hands: number;
  net: number; // your chips won or lost in finished hands
  decisions: Decision[];
}

export interface SessionSummary {
  id: string;
  mode: Mode;
  startedAt: number;
  endedAt: number;
  hands: number;
  decisions: number;
  correct: number;
  net: number;
  byStreet: Record<Street, [number, number]>;
  byPosition: Record<Position, [number, number]>;
  wrongBook: Record<Move, number>; // mistakes grouped by the book move you missed
  mistakes: Decision[];
}

export interface Settings {
  hintsFirst: boolean;
  speed: "fast" | "normal";
}

export interface Persisted {
  v: 1;
  table: Table | null;
  settings: Settings;
  session: Session | null;
  history: SessionSummary[];
}

const KEY = "bythebook.holdem.v1";

export const DEFAULT_SETTINGS: Settings = { hintsFirst: true, speed: "normal" };

export function load(): Persisted {
  const empty: Persisted = { v: 1, table: null, settings: DEFAULT_SETTINGS, session: null, history: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const p = JSON.parse(raw) as Persisted;
    if (p.v !== 1) return empty;
    return { ...empty, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
  } catch {
    return empty;
  }
}

export function save(p: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: stats last for this visit only */
  }
}

export function newSession(mode: Mode): Session {
  return { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, mode, startedAt: Date.now(), hands: 0, net: 0, decisions: [] };
}

const STREETS: Street[] = ["preflop", "flop", "turn", "river"];
const POS: Position[] = ["UTG", "CO", "BTN", "SB", "BB"];

export function summarize(s: Session): SessionSummary {
  const byStreet = Object.fromEntries(STREETS.map((k) => [k, [0, 0]])) as Record<Street, [number, number]>;
  const byPosition = Object.fromEntries(POS.map((k) => [k, [0, 0]])) as Record<Position, [number, number]>;
  const wrongBook: Record<Move, number> = { fold: 0, call: 0, raise: 0 };
  let correct = 0;
  const mistakes: Decision[] = [];
  for (const d of s.decisions) {
    byStreet[d.street][1]++;
    byPosition[d.position][1]++;
    if (d.correct) {
      correct++;
      byStreet[d.street][0]++;
      byPosition[d.position][0]++;
    } else {
      wrongBook[d.book]++;
      mistakes.push(d);
    }
  }
  return {
    id: s.id,
    mode: s.mode,
    startedAt: s.startedAt,
    endedAt: Date.now(),
    hands: s.hands,
    decisions: s.decisions.length,
    correct,
    net: s.net,
    byStreet,
    byPosition,
    wrongBook,
    mistakes: mistakes.slice(-60),
  };
}

export function upsertHistory(history: SessionSummary[], sum: SessionSummary): SessionSummary[] {
  const i = history.findIndex((h) => h.id === sum.id);
  if (i >= 0) {
    const copy = [...history];
    copy[i] = sum;
    return copy;
  }
  return [...history, sum].slice(-200);
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Label for a spot, used to group repeat mistakes: "Preflop · CO · KJo unopened", "Turn · facing a bet". */
export function spotLabel(d: Pick<Decision, "street" | "position" | "cls" | "situation">): string {
  if (d.street === "preflop") return `Preflop · ${d.position} · ${d.cls} ${d.situation}`;
  return `${cap(d.street)} · ${d.situation}`;
}

export const STREET_LIST = STREETS;
export const POSITION_LIST = POS;
