import { describe, expect, it } from "vitest";
import { generate } from "../src/index";
import { EPOCH } from "../src/version";
import { dateRange } from "./dates";

describe("determinism", () => {
  it("is stable across repeated calls for the same date", () => {
    const a = generate("2026-03-14");
    const b = generate("2026-03-14");
    expect(a).toEqual(b);
  });

  it("matches the 365-day golden snapshot", () => {
    const days = dateRange(EPOCH, 365);
    const summary = days.map((dateKey) => {
      const p = generate(dateKey);
      return {
        number: p.number,
        dateKey: p.dateKey,
        troop: p.troop.map((a) => `${a.name}:${a.age}:${a.build}:${a.silver}:${a.scar}`),
        clues: p.clues.map((c) => `${c.kind}|${c.text}`),
        space: p.space,
        solution: p.solution.order,
      };
    });
    expect(summary).toMatchSnapshot();
  });
});
