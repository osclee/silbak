import { describe, it } from "vitest";
import { buildTroop, computeTrueOrder, truthMap } from "../src/troop";
import type { ApeId } from "../src/troop";
import { candidateClues } from "../src/clues";
import type { CandidateClue, Clue } from "../src/clues";
import { selectClues } from "../src/select";
import { allPermutations } from "../src/permutations";
import { hashStr, mulberry32 } from "../src/rng";

/**
 * STANDALONE ANALYSIS — not a correctness test.
 *
 * Sweeps target `space` sizes (fed to the real `selectClues` as a degenerate
 * [target, target] band), generates real puzzle instances with the actual
 * production troop/clue/selection pipeline, and solves each with an adaptive
 * minimax solver.
 *
 * Two feedback variants are compared on the EXACT SAME generated puzzles
 * (paired comparison, same seeds). NEITHER imports production grade.ts —
 * both are defined locally, independent of whatever grade() currently does,
 * so this comparison stays meaningful even after grade.ts changes (as it
 * did: production grade() started directional, and became the "binary"
 * variant below as a direct result of what this file found):
 *   1. "directional" (gradeDirectional) — exact/up/down per rung, matching
 *      grade.ts's ORIGINAL (v1, 5-ape, pre-binary-switch) behavior. Kept as
 *      a fixed historical baseline.
 *   2. "binary" (gradeBinary) — exact/wrong per rung, matching grade.ts's
 *      CURRENT behavior. Duplicated here rather than imported so this file
 *      keeps working as a real comparison tool if grade.ts changes again.
 *
 * TARGETS spans the v2 (6-ape, 720-permutation) engine's achievable range.
 * Structural ceiling is 504 (720 - 120 - 120 + 24, two weak `neg` clues via
 * inclusion-exclusion — see select.ts's BANDS comment); selectClues reliably
 * hits exactly 504 at that target and throws above it.
 *
 * PERFORMANCE NOTE: the minimax step restricts candidate GUESSES to
 * `remaining` itself, not the full permutation universe. At N=5/120 the
 * original version of this file searched the full universe per decision —
 * fine at that scale. At N=6/720 that same approach measured in the tens of
 * minutes and once triggered a 10+-minute stall during the ape-count
 * migration. Restricting to `remaining` is the standard practical
 * simplification for adaptive-guessing solvers at this scale (Knuth's
 * provably-optimal method needs the full universe, which is intractable to
 * require here; real implementations search within remaining candidates).
 *
 * This file intentionally does not assert anything meaningful about game
 * balance — it exists to print tables via console.log. It does not modify
 * any production file.
 */

const ALL_PERMS = allPermutations() as ApeId[][];

const TARGETS = [2, 4, 8, 14, 24, 40, 65, 100, 150, 210, 280, 360, 440, 490, 504];
const TRIALS_PER_TARGET = 20;
const MAX_GUESSES = 12;
const REALISTIC_WIN_CAP = 6; // the real game's guess limit

type FeedbackFn = (guess: readonly ApeId[], order: readonly ApeId[]) => string[];

/** Historical baseline: exact/up/down per rung (grade.ts's v1/5-ape behavior). */
const gradeDirectional: FeedbackFn = (guess, order) => {
  const truth = truthMap(order as ApeId[]);
  return guess.map((apeId, i) => {
    if (truth[apeId] === i) return "exact";
    return truth[apeId] < i ? "up" : "down";
  });
};

/** Current behavior: exact/wrong per rung (mirrors grade.ts as of this writing). */
const gradeBinary: FeedbackFn = (guess, order) => {
  const truth = truthMap(order as ApeId[]);
  return guess.map((apeId, i) => (truth[apeId] === i ? "exact" : "wrong"));
};

interface TrialResult {
  target: number;
  actualSpace: number;
  guesses: number;
  capped: boolean;
}

interface InfeasibleCount {
  target: number;
  infeasible: number;
}

interface PuzzleInstance {
  target: number;
  actualSpace: number;
  initialCandidates: ApeId[][];
  trueOrder: ApeId[];
}

/** Match the stripped {kind,text} clues selectClues returned back to the
 * original CandidateClue objects (with live .test()) from candidateClues(). */
function matchSelected(selected: readonly Clue[], candidates: readonly CandidateClue[]): CandidateClue[] {
  const used = new Set<number>();
  return selected.map((sel) => {
    const idx = candidates.findIndex((c, i) => !used.has(i) && c.kind === sel.kind && c.text === sel.text);
    if (idx === -1) {
      throw new Error(`could not match selected clue back to its candidate: [${sel.kind}] ${sel.text}`);
    }
    used.add(idx);
    return candidates[idx];
  });
}

function feedbackKey(fb: readonly string[]): string {
  return fb.join(",");
}

/** Adaptive minimax solver, guess pool restricted to `remaining` (see the
 * file-level perf note). Parameterized on the feedback function so the same
 * logic drives both variants. */
function solve(
  initialCandidates: ApeId[][],
  trueOrder: ApeId[],
  feedbackFn: FeedbackFn,
  maxGuesses: number,
): { guesses: number; capped: boolean } {
  let remaining = initialCandidates;
  let guesses = 0;

  while (guesses < maxGuesses) {
    let guess: ApeId[];
    if (remaining.length === 1) {
      guess = remaining[0];
    } else {
      let bestGuess: ApeId[] = remaining[0];
      let bestWorst = Infinity;

      for (const g of remaining) {
        const buckets = new Map<string, number>();
        for (const c of remaining) {
          const fb = feedbackKey(feedbackFn(g, c));
          buckets.set(fb, (buckets.get(fb) ?? 0) + 1);
        }
        let worst = 0;
        for (const count of buckets.values()) if (count > worst) worst = count;

        if (worst < bestWorst) {
          bestWorst = worst;
          bestGuess = g;
        }
      }
      guess = bestGuess;
    }

    guesses++;
    const fb = feedbackFn(guess, trueOrder);
    if (fb.every((f) => f === "exact")) {
      return { guesses, capped: false };
    }
    const fbStr = feedbackKey(fb);
    remaining = remaining.filter((c) => feedbackKey(feedbackFn(guess, c)) === fbStr);
  }

  return { guesses: maxGuesses, capped: true };
}

/** Generate the puzzle instances once (real troop/clue/selection pipeline).
 * Independent of feedback function, so both variants solve the identical
 * set of puzzles — a clean paired comparison. */
function buildInstances(): { instances: PuzzleInstance[]; infeasible: InfeasibleCount[] } {
  const instances: PuzzleInstance[] = [];
  const infeasible: InfeasibleCount[] = [];

  for (const target of TARGETS) {
    let infeasibleCount = 0;
    for (let trialIndex = 0; trialIndex < TRIALS_PER_TARGET; trialIndex++) {
      const seed = hashStr(`sim::${target}::${trialIndex}`);
      const rng = mulberry32(seed);

      const troop = buildTroop(rng);
      const trueOrder = computeTrueOrder(troop, rng);
      const candidates = candidateClues(trueOrder, troop);

      // Above the structural ceiling (~504), selectClues() can legitimately
      // fail to construct a puzzle at all — that's a real signal about the
      // clue pool, not a bug. Skip and count.
      let selectResult: { clues: Clue[]; space: number };
      try {
        selectResult = selectClues(candidates, ALL_PERMS, [target, target], rng);
      } catch (err) {
        infeasibleCount++;
        continue;
      }
      const { clues, space } = selectResult;

      const selectedTests = matchSelected(clues, candidates);
      const initialCandidates = ALL_PERMS.filter((o) => selectedTests.every((c) => c.test(o)));

      // Sanity: the true order must always survive its own clues.
      if (!initialCandidates.some((o) => o.every((v, i) => v === trueOrder[i]))) {
        throw new Error(`true order not in initial candidate set for target=${target} trial=${trialIndex}`);
      }
      // The observed space from selectClues should match the filtered count.
      if (initialCandidates.length !== space) {
        throw new Error(
          `space mismatch for target=${target} trial=${trialIndex}: selectClues said ${space}, filter found ${initialCandidates.length}`,
        );
      }

      instances.push({ target, actualSpace: space, initialCandidates, trueOrder });
    }
    infeasible.push({ target, infeasible: infeasibleCount });
  }

  return { instances, infeasible };
}

function solveInstances(instances: PuzzleInstance[], feedbackFn: FeedbackFn, maxGuesses: number): TrialResult[] {
  return instances.map((inst) => {
    const { guesses, capped } = solve(inst.initialCandidates, inst.trueOrder, feedbackFn, maxGuesses);
    return { target: inst.target, actualSpace: inst.actualSpace, guesses, capped };
  });
}

interface Bucket {
  spaceLabel: string;
  n: number;
  avg: number;
  median: number;
  max: number;
  pct3plus: number;
  pct4plus: number;
  pctWithin6: number;
  pct7plus: number;
  capped: number;
}

function summarize(results: TrialResult[]): Bucket[] {
  // Bucket by actual observed space, exact value.
  const bySpace = new Map<number, TrialResult[]>();
  for (const r of results) {
    const arr = bySpace.get(r.actualSpace) ?? [];
    arr.push(r);
    bySpace.set(r.actualSpace, arr);
  }

  const spaces = [...bySpace.keys()].sort((a, b) => a - b);
  const buckets: Bucket[] = [];

  for (const space of spaces) {
    const trials = bySpace.get(space)!;
    const guessCounts = trials.map((t) => t.guesses).sort((a, b) => a - b);
    const n = guessCounts.length;
    const avg = guessCounts.reduce((a, b) => a + b, 0) / n;
    const median =
      n % 2 === 1 ? guessCounts[(n - 1) / 2] : (guessCounts[n / 2 - 1] + guessCounts[n / 2]) / 2;
    const max = guessCounts[n - 1];
    const pct3plus = (guessCounts.filter((g) => g >= 3).length / n) * 100;
    const pct4plus = (guessCounts.filter((g) => g >= 4).length / n) * 100;
    const pctWithin6 = (guessCounts.filter((g) => g <= REALISTIC_WIN_CAP).length / n) * 100;
    const pct7plus = (guessCounts.filter((g) => g > REALISTIC_WIN_CAP).length / n) * 100;
    const capped = trials.filter((t) => t.capped).length;

    buckets.push({
      spaceLabel: String(space),
      n,
      avg,
      median,
      max,
      pct3plus,
      pct4plus,
      pctWithin6,
      pct7plus,
      capped,
    });
  }

  return buckets;
}

function printTable(title: string, buckets: Bucket[]) {
  const cols = [
    "space".padEnd(7),
    "n".padStart(4),
    "avg".padStart(6),
    "median".padStart(7),
    "max".padStart(4),
    "%3+".padStart(6),
    "%4+".padStart(6),
    "win<=6".padStart(7),
    "%7+".padStart(6),
    "capped".padStart(7),
  ];
  const header = cols.join(" | ");
  const sep = "-".repeat(header.length);
  console.log(`\n=== ${title} ===`);
  console.log(header);
  console.log(sep);
  for (const b of buckets) {
    const row = [
      b.spaceLabel.padEnd(7),
      String(b.n).padStart(4),
      b.avg.toFixed(2).padStart(6),
      b.median.toFixed(1).padStart(7),
      String(b.max).padStart(4),
      b.pct3plus.toFixed(0).padStart(5) + "%",
      b.pct4plus.toFixed(0).padStart(5) + "%",
      b.pctWithin6.toFixed(0).padStart(6) + "%",
      b.pct7plus.toFixed(0).padStart(5) + "%",
      String(b.capped).padStart(7),
    ];
    console.log(row.join(" | "));
  }
  console.log(sep + "\n");
}

function printComparison(directional: Bucket[], binary: Bucket[]) {
  const bySpaceDir = new Map(directional.map((b) => [b.spaceLabel, b]));
  const bySpaceBin = new Map(binary.map((b) => [b.spaceLabel, b]));
  const spaces = [...new Set([...bySpaceDir.keys(), ...bySpaceBin.keys()])].sort((a, b) => Number(a) - Number(b));

  const header = [
    "space".padEnd(7),
    "dir-avg".padStart(8),
    "bin-avg".padStart(8),
    "delta".padStart(7),
    "bin-win<=6".padStart(11),
    "bin-%7+".padStart(8),
  ].join(" | ");
  const sep = "-".repeat(header.length);
  console.log("\n=== Directional (v1, historical) vs Binary (v2, current) — paired comparison ===");
  console.log(header);
  console.log(sep);
  for (const space of spaces) {
    const d = bySpaceDir.get(space);
    const b = bySpaceBin.get(space);
    const dAvg = d ? d.avg.toFixed(2) : "  -";
    const bAvg = b ? b.avg.toFixed(2) : "  -";
    const delta = d && b ? (b.avg - d.avg).toFixed(2) : "  -";
    const win6 = b ? b.pctWithin6.toFixed(0) + "%" : "-";
    const p7 = b ? b.pct7plus.toFixed(0) + "%" : "-";
    console.log(
      [
        space.padEnd(7),
        dAvg.padStart(8),
        bAvg.padStart(8),
        delta.padStart(7),
        win6.padStart(11),
        p7.padStart(8),
      ].join(" | "),
    );
  }
  console.log(sep + "\n");
}

describe("difficulty simulation (standalone analysis, not a correctness assertion)", () => {
  it(
    "compares directional (v1, historical) vs binary (v2, current) feedback on identical 6-ape puzzles",
    () => {
      const { instances, infeasible } = buildInstances();

      const anyInfeasible = infeasible.filter((i) => i.infeasible > 0);
      if (anyInfeasible.length > 0) {
        console.log("Infeasible targets (selectClues could not construct a puzzle at this exact target):");
        for (const i of anyInfeasible) {
          console.log(`  target=${i.target}: ${i.infeasible}/${TRIALS_PER_TARGET} trials infeasible`);
        }
        console.log("");
      }

      const directionalResults = solveInstances(instances, gradeDirectional, MAX_GUESSES);
      const binaryResults = solveInstances(instances, gradeBinary, MAX_GUESSES);

      const directionalBuckets = summarize(directionalResults);
      const binaryBuckets = summarize(binaryResults);

      printTable("Directional feedback (v1 historical baseline, exact/up/down)", directionalBuckets);
      printTable("Binary feedback (v2 current, exact/wrong)", binaryBuckets);
      printComparison(directionalBuckets, binaryBuckets);

      const dirUnsolved = directionalResults.some((r) => r.capped);
      if (dirUnsolved) {
        console.warn("WARNING: some DIRECTIONAL trials hit the guess cap without solving — investigate.");
      }
      const binUnsolved = binaryResults.some((r) => r.capped);
      if (binUnsolved) {
        console.warn(`WARNING: some BINARY trials hit the ${MAX_GUESSES}-guess cap without solving — investigate.`);
      }

      if (instances.length === 0) {
        throw new Error("no trials produced any results — check the harness");
      }
    },
    300_000,
  );
});
