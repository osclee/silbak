/** v3: count-only feedback, trait-quantified clues, a relational clue in
 * every set, Fri/Sat bands re-swept, `between`/extreme-`count` reworded —
 * docs/DIFFICULTY-2026-09-13.md §3.1–3.2. The feedback change on its own
 * doesn't alter generation, but the clue pool and bands do, so every puzzle
 * changed with this bump (the seed embeds the version). Fine pre-launch.
 *
 * v2: 6 apes (720 permutations) instead of 5 (120) — see troop.ts's
 * TROOP_SIZE comment and DESIGN.md §9.2 for why. */
export const ENGINE_VERSION = 3;
export const EPOCH = "2026-09-15";

function daysBetween(a: string, b: string): number {
  const msA = Date.parse(`${a}T00:00:00Z`);
  const msB = Date.parse(`${b}T00:00:00Z`);
  return Math.round((msB - msA) / 86400000);
}

export function puzzleNumber(dateKey: string): number {
  return daysBetween(EPOCH, dateKey) + 1;
}
