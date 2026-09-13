import type { ApeId } from "./troop";
import type { CandidateClue, Clue } from "./clues";
import { stripTest } from "./clues";
import { shuffle } from "./rng";

export type Band = readonly [floor: number, ceiling: number];

/**
 * Surviving-solution-space target per weekday (0 = Sunday, per DESIGN.md §4).
 * Tuned for the 6-ape / 720-permutation engine via a difficulty-simulation
 * sweep (test/difficulty-simulation.test.ts) plus an empirical scan of which
 * `space` values selectClues can actually land on.
 *
 * Bands must be wide enough to straddle multiple achievable space values, not
 * just one: DOMINANCE_MARGIN filters candidate clues by a fixed, structural
 * solo-survivor count per clue kind (order/half=360, adjacent=240,
 * count/between=120, neg=600 — always, for any troop, since these only
 * depend on TROOP_SIZE). That gives the eligible-clue pool hard edges at
 * certain ceilings:
 *
 *   ceiling <  75           → all 6 kinds eligible (most diverse)
 *   75  <= ceiling < 150    → count/between filtered out
 *   150 <= ceiling < 225    → adjacent also filtered out (order/half/neg left)
 *   225 <= ceiling < 375    → order/half also filtered out (neg-only pool)
 *   ceiling >= 375          → neg also filtered out → pool empties → falls
 *                             back to the full candidate pool (diverse again)
 *
 * Inside [225, 375), only `neg` clues are eligible, and stacking them lands
 * on a sparse fixed lattice of achievable spaces (empirically {240, 288,
 * 312, 336, 360, 384, 408, 480, 504} — "not silverback"/"not lowest rung" on
 * k distinct apes is a clean inclusion-exclusion count, not a continuum). A
 * band placed entirely inside that zone without spanning multiple lattice
 * points will land on the same space size every single day — verified this
 * bug directly during tuning (a naive proportional scale-up of the 5-ape
 * bands put Friday at [120,240], and it landed on exactly space=240 for
 * 286/286 sampled Fridays despite different troops/clues daily).
 *
 * Structural ceiling is 504 (720 - 120 - 120 + 24, two weak `neg` clues via
 * inclusion-exclusion — same derivation as the 5-ape engine's 78, scaled to
 * N=6); selectClues reliably lands exactly on 504 at that target and throws
 * above it.
 *
 * Guesses-to-solve payoff (Knuth-optimal adaptive solver, real binary
 * grade()): avg climbs from ~1.8 (space~30) to ~3.3-3.45 at the 480-504
 * ceiling, with occasional 5-guess optimal-play trials (~5% of runs at
 * space>=480) — genuinely more difficulty range than the 5-ape engine ever
 * produced (avg maxed ~2.9, max ever 4, 0% needed 5+, up to its own ~78
 * ceiling). Still 100% solved within 6 guesses at every space size tested,
 * all the way to the 504 structural ceiling.
 */
const BANDS: Record<number, Band> = {
  0: [24, 60], // Sun — soft landing
  1: [16, 44], // Mon — nearly deducible
  2: [72, 135], // Tue
  3: [135, 195], // Wed
  4: [195, 224], // Thu — kept just under the 225 "neg-only pool" edge
  5: [240, 360], // Fri — spans 4 lattice points in the neg-only zone
  6: [360, 504], // Sat — deduction sets the frame, guessing does the work
};

export function bandForDateKey(dateKey: string): Band {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return BANDS[day];
}

const MAX_CLUES = 4;
const MIN_CLUES = 2;
const MAX_ATTEMPTS = 240;
const PRIMARY_ATTEMPTS = 180;

/**
 * No single clue may, read alone, already narrow to within this multiple of
 * the ceiling. The strongest possible single clue (pinning one ape's exact
 * rank) leaves 120 of 720 permutations — comfortably above every ceiling in
 * BANDS, so a raw in-band check never catches a clue that does 95% of the
 * work and leaves the rest as filler. This margin is what actually does that
 * job. Tune alongside NOISE in troop.ts if puzzles feel too easy or too
 * grindy.
 */
const DOMINANCE_MARGIN = 1.6;

/** How many of the 720 permutations remain if this were the *only* clue given. */
function soloSurvivors(clue: CandidateClue, allPerms: readonly ApeId[][]): number {
  return allPerms.filter((o) => clue.test(o)).length;
}

function spaceOf(clues: readonly CandidateClue[], allPerms: readonly ApeId[][]): number {
  return allPerms.filter((o) => clues.every((c) => c.test(o))).length;
}

/**
 * True if every clue in the set is load-bearing — dropping any one of them
 * alone pushes the surviving space back out of band. DOMINANCE_MARGIN only
 * rules out a single clue nearly soloing the puzzle; it says nothing about a
 * *pair* already reaching band while a 3rd/4th clue just rides along. This
 * catches that case directly.
 *
 * Checking single-clue removals is sufficient to guarantee every smaller
 * subset also fails to reach band, since dropping a clue can only ever grow
 * (never shrink) the surviving space — no need to enumerate all 2^k subsets.
 */
function isIrreducible(chosen: readonly CandidateClue[], allPerms: readonly ApeId[][], ceiling: number): boolean {
  if (chosen.length <= 1) return true;
  return chosen.every((_, i) => {
    const rest = chosen.filter((_, j) => j !== i);
    return spaceOf(rest, allPerms) > ceiling;
  });
}

function attemptSelect(
  pool: readonly CandidateClue[],
  allPerms: readonly ApeId[][],
  band: Band,
  rng: () => number,
): { chosen: CandidateClue[]; space: number } {
  const [floor, ceiling] = band;
  const shuffled = shuffle(rng, pool);
  let survivors: readonly ApeId[][] = allPerms;
  const chosen: CandidateClue[] = [];

  for (const clue of shuffled) {
    if (chosen.length >= MAX_CLUES) break;
    if (chosen.length >= MIN_CLUES && survivors.length <= ceiling) break;

    const next = survivors.filter((o) => clue.test(o));
    if (next.length < survivors.length && next.length >= floor) {
      survivors = next;
      chosen.push(clue);
    }
  }

  return { chosen, space: survivors.length };
}

/**
 * Greedily select 2–4 clues that narrow the solution space into `band`.
 *
 * Searches a "non-dominant" pool first — candidates excluded if they'd get a
 * player most of the way there on their own (see DOMINANCE_MARGIN) — so
 * reaching the band requires genuinely combining clues. Every in-band result
 * is further required to be irreducible (see isIrreducible) before it's
 * accepted outright. Falls back, in order, to: the full candidate pool if the
 * non-dominant pool can't reach band; the best in-band-but-reducible result
 * seen; then the nearest miss across every attempt.
 */
export function selectClues(
  candidates: readonly CandidateClue[],
  allPerms: readonly ApeId[][],
  band: Band,
  rng: () => number,
): { clues: Clue[]; space: number } {
  const [floor, ceiling] = band;
  const nonDominant = candidates.filter((c) => soloSurvivors(c, allPerms) > ceiling * DOMINANCE_MARGIN);

  const phases: Array<{ pool: readonly CandidateClue[]; attempts: number }> =
    nonDominant.length >= MIN_CLUES
      ? [
          { pool: nonDominant, attempts: PRIMARY_ATTEMPTS },
          { pool: candidates, attempts: MAX_ATTEMPTS - PRIMARY_ATTEMPTS },
        ]
      : [{ pool: candidates, attempts: MAX_ATTEMPTS }];

  let bestInBand: { chosen: CandidateClue[]; space: number } | null = null;
  let nearest: { chosen: CandidateClue[]; space: number } | null = null;
  let nearestDist = Infinity;

  for (const phase of phases) {
    for (let i = 0; i < phase.attempts; i++) {
      const { chosen, space } = attemptSelect(phase.pool, allPerms, band, rng);
      const inBand = space >= floor && space <= ceiling && chosen.length >= MIN_CLUES;

      if (inBand) {
        if (isIrreducible(chosen, allPerms, ceiling)) {
          return { clues: chosen.map(stripTest), space };
        }
        if (!bestInBand) {
          bestInBand = { chosen, space };
        }
        continue;
      }

      if (chosen.length >= MIN_CLUES) {
        const dist = space < floor ? floor - space : space - ceiling;
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = { chosen, space };
        }
      }
    }
  }

  if (bestInBand) {
    return { clues: bestInBand.chosen.map(stripTest), space: bestInBand.space };
  }
  if (nearest) {
    return { clues: nearest.chosen.map(stripTest), space: nearest.space };
  }
  throw new Error("selectClues: unable to find a valid clue set after all attempts");
}
