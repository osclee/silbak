import type { ApeId, FeedbackSignal } from "@silbak/engine";

export interface PersistedHistoryEntry {
  arrangement: ApeId[];
  feedback: FeedbackSignal[];
}

export interface PersistedCurrent {
  dateKey: string;
  arrangement: ApeId[];
  history: PersistedHistoryEntry[];
  status: "playing" | "won" | "lost";
}

export interface Persisted {
  v: 1;
  current?: PersistedCurrent;
  streak: { count: number; max: number; lastPlayedKey: string };
  played: Record<number, { guesses: number; solved: boolean }>;
}

const STORAGE_KEY = "silbak:v1";
const PLAYED_CAP = 60;

/** Daily rollover is local midnight, matching Wordle — never UTC. */
export function todayKey(): string {
  return dateKeyFromDate(new Date());
}

export function yesterdayKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return dateKeyFromDate(d);
}

function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyPersisted(): Persisted {
  return {
    v: 1,
    streak: { count: 0, max: 0, lastPlayedKey: "" },
    played: {},
  };
}

/** Unknown or unparseable payload wipes and starts clean — never throws. */
export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPersisted();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || typeof parsed !== "object") return emptyPersisted();
    return parsed as Persisted;
  } catch {
    return emptyPersisted();
  }
}

export function savePersisted(p: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (private browsing, quota). Gameplay continues in-memory.
  }
}

export function capPlayed(played: Persisted["played"]): Persisted["played"] {
  const keys = Object.keys(played)
    .map(Number)
    .sort((a, b) => a - b);
  if (keys.length <= PLAYED_CAP) return played;
  const drop = keys.slice(0, keys.length - PLAYED_CAP);
  const next = { ...played };
  for (const k of drop) delete next[k];
  return next;
}
