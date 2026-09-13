import { describe, expect, it } from "vitest";
import { generate } from "../src/index";
import { traitWeight } from "../src/troop";
import { EPOCH } from "../src/version";
import { dateRange } from "./dates";

describe("dominance model tuning (DESIGN.md §3 — the NOISE constant)", () => {
  it("the trait-favorite is the true silverback 50-70% of the time over 1000 days", () => {
    const days = dateRange(EPOCH, 1000);
    let hits = 0;
    for (const dateKey of days) {
      const p = generate(dateKey);
      let favorite = p.troop[0];
      for (const ape of p.troop) {
        if (traitWeight(ape) > traitWeight(favorite)) favorite = ape;
      }
      if (favorite.id === p.solution.order[0]) hits++;
    }
    const rate = hits / days.length;
    expect(rate).toBeGreaterThanOrEqual(0.5);
    expect(rate).toBeLessThanOrEqual(0.7);
  });
});
