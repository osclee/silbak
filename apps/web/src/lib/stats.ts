import { EPOCH, MAX_GUESSES, parForDateKey } from "@silbak/engine";
import type { PlayedEntry } from "./storage";
import { dateKeyFromPuzzleNumber } from "./puzzle";

export interface Stats {
  played: number;
  won: number;
  /** Sum of (guesses − par) over this calendar month's daily results. A loss
   *  counts as MAX_GUESSES + 1 strokes — one worse than the worst solve. */
  vsParMonth: number;
  monthLabel: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** guesses − par, golf style; negative is good. */
export function strokesVsPar(entry: PlayedEntry, par: number): number {
  return (entry.solved ? entry.guesses : MAX_GUESSES + 1) - par;
}

/** "on par" / "+2" / "−1". */
export function formatVsPar(delta: number): string {
  if (delta === 0) return "on par";
  return delta > 0 ? `+${delta}` : `−${-delta}`;
}

/** Longer form for the result headline: "one under par", "two over par". */
export function describeVsPar(delta: number): string {
  if (delta === 0) return "On par";
  const words = ["", "one", "two", "three", "four", "five", "six"];
  const n = Math.abs(delta);
  const word = words[n] ?? String(n);
  return delta < 0 ? `${capitalize(word)} under par` : `${capitalize(word)} over par`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function computeStats(played: Record<number, PlayedEntry>, todayKey: string): Stats {
  const month = todayKey.slice(0, 7);
  let count = 0;
  let won = 0;
  let vsParMonth = 0;
  for (const [n, entry] of Object.entries(played)) {
    count++;
    if (entry.solved) won++;
    const dateKey = dateKeyFromPuzzleNumber(EPOCH, Number(n));
    if (dateKey.slice(0, 7) !== month) continue;
    // Entries recorded before par existed derive it from the weekday.
    const par = entry.par ?? parForDateKey(dateKey);
    vsParMonth += strokesVsPar(entry, par);
  }
  const monthIndex = Number(todayKey.slice(5, 7)) - 1;
  return { played: count, won, vsParMonth, monthLabel: MONTHS[monthIndex] ?? month };
}
