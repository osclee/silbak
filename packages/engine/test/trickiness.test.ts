import { describe, expect, it } from "vitest";
import { generate } from "../src/index";
import { candidateClues } from "../src/clues";
import { allPermutations } from "../src/permutations";
import { bandForDateKey } from "../src/select";
import type { ApeId } from "../src/troop";
import { EPOCH } from "../src/version";
import { dateRange } from "./dates";

// Mirrors select.ts's DOMINANCE_MARGIN — kept independent (not imported) so this
// test verifies observed behavior, not just that the constant exists.
const DOMINANCE_MARGIN = 1.6;

function selectedCandidates(clues: { kind: string; text: string }[], candidates: ReturnType<typeof candidateClues>) {
  return clues.map((emitted) => candidates.find((c) => c.kind === emitted.kind && c.text === emitted.text)!);
}

function spaceOf(clues: ReturnType<typeof candidateClues>, allPerms: readonly ApeId[][]): number {
  return allPerms.filter((o) => clues.every((c) => c.test(o))).length;
}

describe("clue-set trickiness (select.ts — no single dominant clue)", () => {
  it("most days require genuinely combining clues, not reading one strong one", () => {
    const days = dateRange(EPOCH, 1000);
    const allPerms = allPermutations() as ApeId[][];

    let compliant = 0;
    for (const dateKey of days) {
      const p = generate(dateKey);
      const [, ceiling] = bandForDateKey(dateKey);
      const candidates = candidateClues(p.solution.order, p.troop);
      const selected = selectedCandidates(p.clues, candidates);

      const noDominantClue = selected.every((c) => spaceOf([c], allPerms) > ceiling * DOMINANCE_MARGIN);
      if (noDominantClue) compliant++;
    }

    // Saturday's ceiling (504) is deliberately in select.ts's ">=375" zone,
    // where even the strongest solo clue (neg, 600/720 survivors) can't
    // clear ceiling*DOMINANCE_MARGIN (504*1.6=806.4 > 720 is impossible) —
    // the non-dominant pool structurally empties and every Saturday falls
    // back to the full candidate pool by design (see select.ts's BANDS
    // comment). That's exactly 1-in-7 days exempt from this specific check;
    // every other day should still be 100% compliant.
    expect(compliant / days.length).toBeGreaterThanOrEqual(0.8);
  });

  it("most days are irreducible — no proper subset of the clues already reaches band", () => {
    const days = dateRange(EPOCH, 1000);
    const allPerms = allPermutations() as ApeId[][];

    let irreducible = 0;
    for (const dateKey of days) {
      const p = generate(dateKey);
      const [, ceiling] = bandForDateKey(dateKey);
      const candidates = candidateClues(p.solution.order, p.troop);
      const selected = selectedCandidates(p.clues, candidates);

      if (selected.length <= 1) {
        irreducible++;
        continue;
      }
      const noRedundantClue = selected.every((_, i) => {
        const rest = selected.filter((_, j) => j !== i);
        return spaceOf(rest, allPerms) > ceiling;
      });
      if (noRedundantClue) irreducible++;
    }

    // Falls back to "best in-band" (possibly reducible) only when the search
    // budget is exhausted — should be the rare exception, not routine.
    expect(irreducible / days.length).toBeGreaterThanOrEqual(0.95);
  });

  it("every clue set is still 2-4 clues with a valid, verified space (regression guard)", () => {
    const days = dateRange(EPOCH, 200);
    const allPerms = allPermutations() as ApeId[][];
    for (const dateKey of days) {
      const p = generate(dateKey);
      expect(p.clues.length).toBeGreaterThanOrEqual(2);
      expect(p.clues.length).toBeLessThanOrEqual(4);

      const candidates = candidateClues(p.solution.order, p.troop);
      const selected = selectedCandidates(p.clues, candidates);
      const survivors = allPerms.filter((perm) => selected.every((c) => c.test(perm)));
      expect(survivors.length).toBe(p.space);
    }
  });
});
