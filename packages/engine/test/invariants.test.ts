import { describe, expect, it } from "vitest";
import { generate } from "../src/index";
import { candidateClues } from "../src/clues";
import { allPermutations } from "../src/permutations";
import { bandForDateKey } from "../src/select";
import type { ApeId } from "../src/troop";
import { TROOP_SIZE } from "../src/troop";
import { EPOCH } from "../src/version";
import { dateRange } from "./dates";

// ~2 years so every weekday band gets exercised many times.
const days = dateRange(EPOCH, 700);
const puzzles = days.map((d) => generate(d));

describe("generator invariants (DESIGN.md §4)", () => {
  it("clue count is always between 2 and 4", () => {
    for (const p of puzzles) {
      expect(p.clues.length).toBeGreaterThanOrEqual(2);
      expect(p.clues.length).toBeLessThanOrEqual(4);
    }
  });

  it("space is never fully determined, and matches brute-force verification over all 720 permutations", () => {
    const allPerms = allPermutations() as ApeId[][];
    for (const p of puzzles) {
      const candidates = candidateClues(p.solution.order, p.troop);
      const selected = candidates.filter((c) =>
        p.clues.some((emitted) => emitted.kind === c.kind && emitted.text === c.text),
      );
      expect(selected.length).toBe(p.clues.length);

      const survivors = allPerms.filter((perm) => selected.every((c) => c.test(perm)));
      expect(survivors.length).toBe(p.space);
      expect(p.space).toBeGreaterThanOrEqual(2);

      const solutionSurvives = survivors.some((perm) => perm.join(",") === p.solution.order.join(","));
      expect(solutionSurvives).toBe(true);
    }
  });

  it("every emitted clue is true of the solution", () => {
    for (const p of puzzles) {
      const candidates = candidateClues(p.solution.order, p.troop);
      for (const emitted of p.clues) {
        const match = candidates.find((c) => c.kind === emitted.kind && c.text === emitted.text);
        expect(match).toBeDefined();
        expect(match!.test(p.solution.order)).toBe(true);
      }
    }
  });

  it("silvering never exceeds its age gate", () => {
    for (const p of puzzles) {
      for (const ape of p.troop) {
        if (ape.age === "juvenile") {
          expect(["none", "flecked"]).toContain(ape.silver);
        } else if (ape.age === "subadult") {
          expect(["none", "flecked", "part-silver"]).toContain(ape.silver);
        }
      }
    }
  });

  it("every troop has six distinct names", () => {
    for (const p of puzzles) {
      const names = new Set(p.troop.map((a) => a.name));
      expect(names.size).toBe(TROOP_SIZE);
    }
  });

  it("no two apes in a troop share every trait (age, build, silver, scar)", () => {
    for (const p of puzzles) {
      const tuples = new Set(p.troop.map((a) => `${a.age}|${a.build}|${a.silver}|${a.scar}`));
      expect(tuples.size).toBe(TROOP_SIZE);
    }
  });

  it("band adherence holds for at least 95% of days", () => {
    let inBand = 0;
    for (let i = 0; i < days.length; i++) {
      const band = bandForDateKey(days[i]);
      const p = puzzles[i];
      if (p.space >= band[0] && p.space <= band[1]) inBand++;
    }
    expect(inBand / days.length).toBeGreaterThanOrEqual(0.95);
  });
});
