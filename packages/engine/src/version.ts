/** v3: count-only feedback, trait-quantified clues, a relational clue in
 * every set, Fri/Sat bands re-swept, `between`/extreme-`count` reworded —
 * docs/DIFFICULTY-2026-09-13.md §3.1–3.2. The feedback change on its own
 * doesn't alter generation, but the clue pool and bands do, so every puzzle
 * changed with this bump (the seed embeds the version). Fine pre-launch.
 *
 * v2: 6 apes (720 permutations) instead of 5 (120) — see troop.ts's
 * TROOP_SIZE comment and DESIGN.md §9.2 for why. */
export const ENGINE_VERSION = 3;
/**
 * Day 1. Backdated fourteen days before launch (was 2026-09-16, launch day
 * itself) for two reasons, neither of which touches generation:
 *
 * - **The archive was empty on day one.** `generate()` keys off `dateKey`, not
 *   `number`, so moving EPOCH renumbers puzzles without changing a single one
 *   of them — every date still yields exactly the puzzle it always did. What
 *   it buys is fourteen playable days behind launch day for anyone who
 *   arrives, likes it, and wants another.
 * - **Players west of UTC saw "Troop #0".** `todayKey()` is deliberately local
 *   (storage.ts — daily rollover is local midnight, matching Wordle), but
 *   `puzzleNumber` counts from this UTC epoch. With EPOCH on launch day, a
 *   player in UTC-10 whose local date was still the day before got
 *   `number = 0`, and the day before that `-1`. An epoch safely in the past
 *   removes the case by construction rather than clamping it after the fact.
 *
 * Renumbering is a one-time, pre-launch move: once real players have `played`
 * entries keyed by puzzle number, shifting EPOCH would silently relabel their
 * history. Don't touch it after launch.
 */
export const EPOCH = "2026-09-02";

function daysBetween(a: string, b: string): number {
  const msA = Date.parse(`${a}T00:00:00Z`);
  const msB = Date.parse(`${b}T00:00:00Z`);
  return Math.round((msB - msA) / 86400000);
}

export function puzzleNumber(dateKey: string): number {
  return daysBetween(EPOCH, dateKey) + 1;
}
