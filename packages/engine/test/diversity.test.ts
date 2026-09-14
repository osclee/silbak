import { describe, expect, it } from "vitest";
import { generate } from "../src/index";
import type { ClueKind } from "../src/clues";
import { EPOCH } from "../src/version";
import { dateRange } from "./dates";

/**
 * The band-adherence test in invariants.test.ts checks membership in
 * [floor, ceiling]; it cannot see a band that lands on the *same* space with
 * the *same* clue kinds every week. That is exactly what v2's Friday
 * (space=240, 286/286 days) and Saturday (two `neg` clues, every week) did —
 * docs/REVIEW-2026-09-13.md A.4 #5. These assertions would have caught both.
 */

// Mirrors select.ts's RELATIONAL_KINDS — kept independent so this test
// checks observed output, not that the constant exists.
const RELATIONAL: ReadonlySet<ClueKind> = new Set<ClueKind>([
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

const DAYS = 105 * 7; // 105 samples of every weekday
const days = dateRange(EPOCH, DAYS);
const puzzles = days.map((d) => generate(d));
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

describe("clue-set diversity (select.ts BANDS — no weekday is a lattice point)", () => {
  it("every puzzle carries at least one relational clue", () => {
    for (const p of puzzles) {
      expect(p.clues.some((c) => RELATIONAL.has(c.kind)), `#${p.number} ${p.clues.map((c) => c.kind).join(",")}`).toBe(
        true,
      );
    }
  });

  it("each weekday lands on at least 4 distinct spaces and 4 distinct kind signatures", () => {
    const spaces = new Map<number, Set<number>>();
    const sigs = new Map<number, Set<string>>();
    days.forEach((d, i) => {
      const w = weekday(d);
      const p = puzzles[i];
      (spaces.get(w) ?? spaces.set(w, new Set()).get(w)!).add(p.space);
      (sigs.get(w) ?? sigs.set(w, new Set()).get(w)!).add([...new Set(p.clues.map((c) => c.kind))].sort().join(","));
    });
    for (let w = 0; w < 7; w++) {
      expect(spaces.get(w)!.size, `weekday ${w} distinct spaces`).toBeGreaterThanOrEqual(4);
      expect(sigs.get(w)!.size, `weekday ${w} distinct kind signatures`).toBeGreaterThanOrEqual(4);
    }
  });

  it("trait-quantified clues appear on most days but rarely make up the whole set", () => {
    let any = 0;
    let all = 0;
    for (const p of puzzles) {
      const t = p.clues.filter((c) => c.kind.startsWith("t-")).length;
      if (t > 0) any++;
      if (t === p.clues.length) all++;
    }
    expect(any / puzzles.length).toBeGreaterThanOrEqual(0.6);
    expect(all / puzzles.length).toBeLessThanOrEqual(0.4);
  });
});
