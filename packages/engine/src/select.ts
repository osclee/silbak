import type { ApeId } from "./troop";
import type { CandidateClue, Clue, ClueKind } from "./clues";
import { stripTest } from "./clues";
import { shuffle } from "./rng";

export type Band = readonly [floor: number, ceiling: number];

/**
 * Surviving-solution-space target per weekday (0 = Sunday, per DESIGN.md §4).
 * Tuned for the 6-ape / 720-permutation engine via a difficulty-simulation
 * sweep (test/difficulty-simulation.test.ts) plus an empirical scan of which
 * `space` values selectClues can actually land on — re-swept for v3 when
 * the trait-quantified clue family landed and the weekend bands were rebuilt
 * (docs/DIFFICULTY-2026-09-13.md §3.2).
 *
 * Bands must be wide enough to straddle multiple achievable space values, not
 * just one. Named clues have a fixed, structural solo-survivor count per kind
 * (order/half=360, adjacent=240, count/between=120, neg=600 — for any troop,
 * since these only depend on TROOP_SIZE), and dominanceThreshold() filters
 * the primary pool by that count, which gives the eligible pool hard edges at
 * certain ceilings:
 *
 *   ceiling <  75           → every named kind eligible
 *   75  <= ceiling < 150    → count/between filtered out
 *   150 <= ceiling < 225    → adjacent also filtered out
 *   ceiling >= 219          → threshold pinned at DOMINANCE_CAP (350):
 *                             order/half/neg stay eligible at every ceiling
 *
 * Trait-quantified clues (`t-*`, clues.ts) have no fixed solo strength — it
 * depends on the troop's class sizes and lands anywhere from ~50 to ~650 —
 * so they fill the gaps between the named kinds' lattice points. That is the
 * whole reason they exist: before them, a v2 band placed inside [225, 375)
 * could only stack `neg` clues, whose inclusion-exclusion counts form a
 * sparse lattice ({240, 288, 312, 336, 360, 384, 408, 480, 504}), and Friday
 * landed on space=240 for 286/286 sampled Fridays while Saturday was two
 * `neg` clues every single week. Any future band change should still be
 * checked for diversity (test/diversity.test.ts), not just for in-band rate.
 *
 * Measured over 364 days (v3 pool, capped threshold, relational-clue rule):
 * every weekday lands in band, irreducible, on the primary pool 100% of the
 * time; distinct spaces per weekday run 12–18 and distinct kind signatures
 * 14–41. The `bestInBand` / `nearest` fallbacks in selectClues have not been
 * observed to fire; they are a safety net, not a path puzzles take.
 *
 * Guesses-to-solve (trait-greedy solver, count-only grade(), same 364 days):
 * Mon 2.2 · Sun 2.4 · Tue 2.5 · Wed 2.6 · Thu 2.8 · Fri 3.0 · Sat 3.0, with
 * 30–32% of weekend puzzles needing 4+ and no losses at 6. Space stops
 * predicting solver difficulty much past ~250; what Saturday buys over Friday
 * is that every set carries a trait clue (55% are trait clues only), and the
 * decode step — "which apes are the elders, and does every one of them clear
 * every subadult?" — is human cost the solver doesn't pay.
 */
const BANDS: Record<number, Band> = {
  0: [24, 60], // Sun — soft landing
  1: [16, 44], // Mon — nearly deducible
  2: [72, 135], // Tue
  3: [135, 195], // Wed
  4: [195, 224], // Thu
  5: [225, 300], // Fri — order/half + neg or trait mixes; 26 kind signatures
  6: [288, 400], // Sat — trait clue in every set; deduction sets the frame
};

function weekday(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function bandForDateKey(dateKey: string): Band {
  return BANDS[weekday(dateKey)];
}

/**
 * Expected guesses per weekday (0 = Sunday) — the "par" on the share line
 * and result card (DESIGN.md §5). Set from the v3 blind playtest (38
 * puzzles, DESIGN.md §9.6), not from the solver: agents averaged 4.05 with
 * per-weekday medians Mon 5 · Tue 4 · Wed 5 · Thu 5 · Fri 3.5 · Sat 5 ·
 * Sun 3 on 5–6 samples each, which is too thin to honour day by day, so
 * these are those medians smoothed into the modelled Mon→Sat ramp and
 * shifted about one guess above the doc's hypothesis (Mon 2 · Tue–Thu 3 ·
 * Fri–Sat 4 · Sun 3). Revisit once real play has a month of `played`
 * entries; the entries record the par they were scored against.
 */
const PAR: Record<number, number> = {
  0: 3, // Sun
  1: 3, // Mon
  2: 4, // Tue
  3: 4, // Wed
  4: 4, // Thu
  5: 4, // Fri
  6: 5, // Sat
};

export function parForDateKey(dateKey: string): number {
  return PAR[weekday(dateKey)];
}

const MAX_CLUES = 4;
const MIN_CLUES = 2;

/**
 * Kinds that carry relative-order or zone information. Every clue set must
 * contain at least one — a set of nothing but `neg` / `t-rung` ("X is not
 * the silverback" stacked) narrows the space on paper while telling the
 * player nothing about who stands over whom, which is what 29% of v2
 * puzzles (every Friday and Saturday) were. See docs/REVIEW-2026-09-13.md
 * A.4 #5.
 */
const RELATIONAL_KINDS: ReadonlySet<ClueKind> = new Set<ClueKind>([
  "order",
  "adjacent",
  "between",
  "half",
  "count",
  "t-order",
  "t-adj",
  "t-pair",
  "t-zone",
  "t-count",
]);

function hasRelational(clues: readonly CandidateClue[]): boolean {
  return clues.some((c) => RELATIONAL_KINDS.has(c.kind));
}
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

/**
 * Ceiling on the margin threshold. Without it, any ceiling >= 225 pushes
 * `ceiling * DOMINANCE_MARGIN` past 360 — the solo strength of `order` and
 * `half` — and the primary pool for Friday and Saturday collapses to `neg`
 * plus the weakest trait clues, which is how v2's weekend became "three
 * negs and a t-pair" every single week. 350 keeps the two named relational
 * kinds eligible at every ceiling while still excluding `adjacent` (240)
 * and `count`/`between` (120), and changes nothing for Sunday–Thursday,
 * whose thresholds already sit below it.
 */
const DOMINANCE_CAP = 350;

function dominanceThreshold(ceiling: number): number {
  return Math.min(ceiling * DOMINANCE_MARGIN, DOMINANCE_CAP);
}

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
    const relational = hasRelational(chosen);
    if (chosen.length >= MIN_CLUES && survivors.length <= ceiling && relational) break;
    // Already in band but nothing relational yet: only a relational clue can
    // finish the set, so don't spend the remaining slots on another `neg`.
    if (survivors.length <= ceiling && !relational && !RELATIONAL_KINDS.has(clue.kind)) continue;

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
  const threshold = dominanceThreshold(ceiling);
  const nonDominant = candidates.filter((c) => soloSurvivors(c, allPerms) > threshold);

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
      const inBand = space >= floor && space <= ceiling && chosen.length >= MIN_CLUES && hasRelational(chosen);

      if (inBand) {
        if (isIrreducible(chosen, allPerms, ceiling)) {
          return { clues: chosen.map(stripTest), space };
        }
        if (!bestInBand) {
          bestInBand = { chosen, space };
        }
        continue;
      }

      if (chosen.length >= MIN_CLUES && hasRelational(chosen)) {
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
