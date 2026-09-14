import type { ApeId, Feedback } from "@silbak/engine";

export interface PersistedHistoryEntry {
  arrangement: ApeId[];
  feedback: Feedback;
}

/** Player-made ledger marks, keyed `${apeId}:${rung}` — see DeductionGrid. */
export type Mark = "no" | "yes";
export type Marks = Record<string, Mark>;

export interface PersistedCurrent {
  dateKey: string;
  arrangement: ApeId[];
  history: PersistedHistoryEntry[];
  status: "playing" | "won" | "lost";
  marks: Marks;
}

export interface PlayedEntry {
  guesses: number;
  solved: boolean;
  /** The weekday par the player faced. Missing on entries recorded before
   *  par existed; derive it from the puzzle number in that case. */
  par?: number;
}

export interface Persisted {
  v: 2;
  current?: PersistedCurrent;
  streak: { count: number; max: number; lastPlayedKey: string };
  played: Record<number, PlayedEntry>;
}

const STORAGE_KEY = "silbak:v2";
const LEGACY_KEY = "silbak:v1";
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
    v: 2,
    streak: { count: 0, max: 0, lastPlayedKey: "" },
    played: {},
  };
}

/**
 * Unknown or unparseable payload wipes and starts clean — never throws.
 *
 * A v1 envelope (per-rung feedback, engine v2 puzzles) keeps its streak and
 * played record — those are the player's history, whatever the engine did —
 * and drops `current`, whose history entries no longer match either the
 * feedback shape or the puzzle it was recorded against.
 */
export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.v === 2) return parsed as Persisted;
      return emptyPersisted();
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed && typeof parsed === "object" && parsed.v === 1) {
        const migrated: Persisted = {
          v: 2,
          streak: parsed.streak ?? emptyPersisted().streak,
          played: parsed.played ?? {},
        };
        savePersisted(migrated);
        localStorage.removeItem(LEGACY_KEY);
        return migrated;
      }
    }
    return emptyPersisted();
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
