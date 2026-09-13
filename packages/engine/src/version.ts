/** v2: 6 apes (720 permutations) instead of 5 (120) — see troop.ts's
 * TROOP_SIZE comment and DESIGN.md §9.2 for why. Every puzzle changed with
 * this bump (the seed embeds the version), which is fine pre-launch — no
 * live players depend on v1 puzzle continuity yet. */
export const ENGINE_VERSION = 2;
export const EPOCH = "2026-01-01";

function daysBetween(a: string, b: string): number {
  const msA = Date.parse(`${a}T00:00:00Z`);
  const msB = Date.parse(`${b}T00:00:00Z`);
  return Math.round((msB - msA) / 86400000);
}

export function puzzleNumber(dateKey: string): number {
  return daysBetween(EPOCH, dateKey) + 1;
}
