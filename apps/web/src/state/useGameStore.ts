import { create } from "zustand";
import { grade, isSolved, puzzleNumber } from "@silbak/engine";
import type { ApeId, FeedbackSignal, Puzzle, Solution } from "@silbak/engine";
import { arraysEqual } from "../lib/arrays";
import { loadPuzzle } from "../lib/puzzle";
import {
  capPlayed,
  loadPersisted,
  savePersisted,
  todayKey,
  yesterdayKey,
} from "../lib/storage";
import type { Persisted, PersistedHistoryEntry } from "../lib/storage";

export interface HistoryEntry {
  arrangement: ApeId[];
  feedback: FeedbackSignal[];
}

export type GameStatus = "playing" | "won" | "lost";

export const MAX_GUESSES = 6;

interface GameState {
  dateKey: string;
  puzzle: Puzzle;
  arrangement: ApeId[];
  selected: number | null;
  history: HistoryEntry[];
  status: GameStatus;
  streak: { count: number; max: number };
  isArchive: boolean;
  /** Only populated once the game ends — DESIGN.md §2: "Loss reveals the true order." */
  revealOrder: ApeId[] | null;
  select: (rungIndex: number) => void;
  submit: () => void;
  load: (dateKey: string, opts?: { archive?: boolean }) => void;
}

// The solution never enters exposed state — components can only ever read `puzzle`.
let currentSolution: Solution | null = null;

/** Safety net for a day that rolled over without going through `submit()`'s own
 *  streak/played bookkeeping — either the day was opened but never played (in
 *  which case it's neither a win nor a loss and leaves no trace), or a terminal
 *  submit happened but predates that bookkeeping existing (`played[number]` is
 *  still missing). A day whose terminal submit already recorded itself is a
 *  no-op here, so this can never double-count a streak. */
function applyRollover(p: Persisted, today: string): Persisted {
  if (!p.current || p.current.dateKey === today) return p;
  const { current } = p;
  if (current.history.length === 0) return { ...p, current: undefined };

  const number = puzzleNumber(current.dateKey);
  if (p.played[number] !== undefined) return { ...p, current: undefined };

  const solved = current.status === "won";
  const played = capPlayed({
    ...p.played,
    [number]: { guesses: current.history.length, solved },
  });

  let streak = { ...p.streak };
  if (solved) {
    streak.count = streak.lastPlayedKey === yesterdayKey(current.dateKey) ? streak.count + 1 : 1;
    streak.max = Math.max(streak.max, streak.count);
  } else {
    streak.count = 0;
  }
  streak.lastPlayedKey = current.dateKey;

  return { ...p, current: undefined, played, streak };
}

function toHistoryEntry(e: PersistedHistoryEntry): HistoryEntry {
  return { arrangement: e.arrangement, feedback: e.feedback };
}

export const useGameStore = create<GameState>((set, get) => ({
  dateKey: "",
  puzzle: { number: 0, dateKey: "", engineVersion: 0, troop: [], clues: [], space: 0 },
  arrangement: [],
  selected: null,
  history: [],
  status: "playing",
  streak: { count: 0, max: 0 },
  isArchive: false,
  revealOrder: null,

  select: (rungIndex) => {
    const { selected, arrangement, status } = get();
    if (status !== "playing") return;
    if (selected === null) {
      set({ selected: rungIndex });
      return;
    }
    if (selected === rungIndex) {
      set({ selected: null });
      return;
    }
    const next = arrangement.slice();
    [next[selected], next[rungIndex]] = [next[rungIndex], next[selected]];
    set({ arrangement: next, selected: null });
  },

  submit: () => {
    const { puzzle, arrangement, history, status, dateKey, isArchive } = get();
    if (status !== "playing" || !currentSolution) return;
    const lastEntry = history[history.length - 1];
    if (lastEntry && arraysEqual(lastEntry.arrangement, arrangement)) return;

    const feedback = grade(arrangement, currentSolution);
    const nextHistory = [...history, { arrangement, feedback }];
    const solved = isSolved(feedback);
    const nextStatus: GameStatus = solved ? "won" : nextHistory.length >= MAX_GUESSES ? "lost" : "playing";
    const revealOrder = nextStatus !== "playing" ? currentSolution.order : null;

    if (isArchive) {
      set({ history: nextHistory, status: nextStatus, selected: null, revealOrder });
      return;
    }

    const persisted = loadPersisted();
    persisted.current = { dateKey, arrangement, history: nextHistory, status: nextStatus };

    // The terminal submit is the one moment a day's outcome is knowable, so
    // streak/played are written right here rather than waiting for the next
    // day's rollover — see applyRollover for why that made every streak wrong.
    let streak = persisted.streak;
    if (nextStatus !== "playing") {
      persisted.played = capPlayed({
        ...persisted.played,
        [puzzle.number]: { guesses: nextHistory.length, solved },
      });
      const count = solved ? (persisted.streak.lastPlayedKey === yesterdayKey(dateKey) ? persisted.streak.count + 1 : 1) : 0;
      streak = { count, max: Math.max(persisted.streak.max, count), lastPlayedKey: dateKey };
      persisted.streak = streak;
    }
    savePersisted(persisted);

    set({
      history: nextHistory,
      status: nextStatus,
      selected: null,
      revealOrder,
      streak: { count: streak.count, max: streak.max },
    });
  },

  load: (dateKey, opts) => {
    const isArchive = opts?.archive ?? false;
    const { puzzle, solution } = loadPuzzle(dateKey);
    currentSolution = solution;

    if (isArchive) {
      set({
        dateKey,
        puzzle,
        arrangement: puzzle.troop.map((a) => a.id),
        selected: null,
        history: [],
        status: "playing",
        isArchive: true,
        revealOrder: null,
      });
      return;
    }

    let persisted = loadPersisted();
    persisted = applyRollover(persisted, dateKey);

    if (persisted.current && persisted.current.dateKey === dateKey) {
      set({
        dateKey,
        puzzle,
        arrangement: persisted.current.arrangement,
        selected: null,
        history: persisted.current.history.map(toHistoryEntry),
        status: persisted.current.status,
        streak: { count: persisted.streak.count, max: persisted.streak.max },
        isArchive: false,
        revealOrder: persisted.current.status !== "playing" ? solution.order : null,
      });
    } else {
      // Deliberately doesn't set `persisted.current` here — a day that's only
      // been opened, never played, shouldn't leave a trace `applyRollover`
      // could mistake for a loss. `submit()` is the only place `current` gets
      // written for a daily puzzle.
      set({
        dateKey,
        puzzle,
        arrangement: puzzle.troop.map((a) => a.id),
        selected: null,
        history: [],
        status: "playing",
        streak: { count: persisted.streak.count, max: persisted.streak.max },
        isArchive: false,
        revealOrder: null,
      });
    }
    savePersisted(persisted);
  },
}));

export function startDaily(): void {
  useGameStore.getState().load(todayKey());
}
