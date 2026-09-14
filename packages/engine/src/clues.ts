import type { Ape, ApeId } from "./troop";
import { TROOP_SIZE } from "./troop";
import { traitClasses } from "./classes";
import type { TraitClass } from "./classes";

/**
 * Named clues talk about specific apes; `t-*` clues quantify over a trait
 * class ("every elder", "the two heavy apes") and make the player decode
 * which apes that is before the clue says anything. See DESIGN.md §4.
 */
export type ClueKind =
  | "order"
  | "adjacent"
  | "count"
  | "neg"
  | "half"
  | "between"
  | "t-order"
  | "t-zone"
  | "t-rung"
  | "t-adj"
  | "t-count"
  | "t-pair";

export interface Clue {
  kind: ClueKind;
  text: string;
}

/** A clue plus the predicate used to test candidate orders during selection. */
export interface CandidateClue extends Clue {
  test: (order: readonly ApeId[]) => boolean;
}

function rankOf(order: readonly ApeId[], apeId: ApeId): number {
  return order.indexOf(apeId);
}

export function stripTest(c: CandidateClue): Clue {
  return { kind: c.kind, text: c.text };
}

/** Half-clue split point — top 3 / bottom 3 for an even 6-ape troop. */
const HALF_SPLIT = TROOP_SIZE / 2;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

/**
 * Generate every clue that is true of `order` (index 0 = silverback).
 * Phrasing rule: clarity beats flavor whenever flavor could change the parse.
 */
export function candidateClues(order: readonly ApeId[], apes: readonly Ape[]): CandidateClue[] {
  const name = (id: ApeId) => apes[id].name;
  const candidates: CandidateClue[] = [];
  const n = TROOP_SIZE;

  // order — every pair, phrased from the less dominant ape's perspective.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const higher = order[i];
      const lower = order[j];
      candidates.push({
        kind: "order",
        text: `${name(lower)} steps aside when ${name(higher)} approaches.`,
        test: (o) => rankOf(o, lower) > rankOf(o, higher),
      });
    }
  }

  // adjacent — true neighbors in the true order.
  for (let i = 0; i < n - 1; i++) {
    const a = order[i];
    const b = order[i + 1];
    candidates.push({
      kind: "adjacent",
      text: `${name(a)} and ${name(b)} — no one ranks in between.`,
      test: (o) => Math.abs(rankOf(o, a) - rankOf(o, b)) === 1,
    });
  }

  // count — how many rank below a given ape. At the extremes this pins the
  // silverback or the omega outright, so it says so instead of dressing the
  // giveaway up as arithmetic ("5 of the troop groom below X").
  for (let i = 0; i < n; i++) {
    const x = order[i];
    const count = n - 1 - i;
    const text =
      count === n - 1
        ? `${name(x)} is the silverback.`
        : count === 0
          ? `${name(x)} holds the lowest rung.`
          : `${count} of the troop groom below ${name(x)}.`;
    candidates.push({
      kind: "count",
      text,
      test: (o) => n - 1 - rankOf(o, x) === count,
    });
  }

  // neg — negative constraints on the extremes.
  for (let i = 1; i < n; i++) {
    const x = order[i];
    candidates.push({
      kind: "neg",
      text: `${name(x)} is not the silverback.`,
      test: (o) => rankOf(o, x) !== 0,
    });
  }
  for (let i = 0; i < n - 1; i++) {
    const x = order[i];
    candidates.push({
      kind: "neg",
      text: `${name(x)} does not hold the lowest rung.`,
      test: (o) => rankOf(o, x) !== n - 1,
    });
  }

  // half — top half / bottom half (top three / bottom three at N=6).
  for (let i = 0; i < HALF_SPLIT; i++) {
    const x = order[i];
    candidates.push({
      kind: "half",
      text: `${name(x)} ranks in the top ${WORDS[HALF_SPLIT]}.`,
      test: (o) => rankOf(o, x) < HALF_SPLIT,
    });
  }
  for (let i = HALF_SPLIT; i < n; i++) {
    const x = order[i];
    candidates.push({
      kind: "half",
      text: `${name(x)} ranks in the bottom ${WORDS[n - HALF_SPLIT]}.`,
      test: (o) => rankOf(o, x) >= HALF_SPLIT,
    });
  }

  // between — strict triples. The wording names which end is which: the
  // old "Y ranks somewhere between X and Z" was read symmetrically by real
  // players (240 survivors) while the predicate was strict (120).
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const x = order[i];
        const y = order[j];
        const z = order[k];
        candidates.push({
          kind: "between",
          text: `${name(y)} ranks below ${name(x)} but above ${name(z)}.`,
          test: (o) => rankOf(o, x) < rankOf(o, y) && rankOf(o, y) < rankOf(o, z),
        });
      }
    }
  }

  candidates.push(...traitClues(order, apes));

  // Two classes can phrase the same fact identically ("The silverback is
  // scarred." arises from both the scarred class's `is` and the unscarred
  // class's `isNot`). Selection matches emitted clues back to candidates by
  // text, so each text may appear once.
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.text)) return false;
    seen.add(c.text);
    return true;
  });
}

/**
 * Clues quantified over trait classes. Two rules, both learned while
 * prototyping (docs/DIFFICULTY-2026-09-13.md §3.2):
 *
 * - A class of size 1 is never used — "every heavy ape outranks every
 *   subadult" with one of each is a named `order` clue in a costume. Classes
 *   are 2–4 apes; the whole troop is never a class (traitClasses enforces).
 * - Two classes in one clue never overlap. Classes of the *same* trait are
 *   disjoint by construction; classes of different traits (a heavy ape that
 *   is also scarred) are only paired when their member sets don't intersect.
 */
function traitClues(order: readonly ApeId[], apes: readonly Ape[]): CandidateClue[] {
  const out: CandidateClue[] = [];
  const n = TROOP_SIZE;
  const classes = traitClasses(apes);
  const rank = (o: readonly ApeId[], id: ApeId) => rankOf(o, id);
  const ranksOf = (o: readonly ApeId[], c: TraitClass) => c.members.map((id) => rank(o, id));
  const disjoint = (a: TraitClass, b: TraitClass) => !a.members.some((id) => b.members.includes(id));

  // Zones the positional kinds talk about. Label and predicate live side by
  // side so the text and the test can't drift apart.
  const zones = [
    { label: "top two", inZone: (r: number) => r < 2 },
    { label: "top three", inZone: (r: number) => r < 3 },
    { label: "bottom three", inZone: (r: number) => r >= n - 3 },
    { label: "bottom two", inZone: (r: number) => r >= n - 2 },
  ];

  for (const a of classes) {
    // t-zone — a class wholly inside or wholly outside a zone. Only the form
    // that reads naturally is emitted for each zone: "outside the top two"
    // rather than "inside the bottom four".
    for (const z of zones) {
      const rs = ranksOf(order, a);
      if (rs.every(z.inZone) && a.size <= 3) {
        out.push({
          kind: "t-zone",
          text: `Every ${a.singular} ranks in the ${z.label}.`,
          test: (o) => ranksOf(o, a).every(z.inZone),
        });
      }
      if (rs.every((r) => !z.inZone(r)) && (z.label === "top two" || z.label === "bottom two")) {
        out.push({
          kind: "t-zone",
          text: `Every ${a.singular} ranks outside the ${z.label}.`,
          test: (o) => ranksOf(o, a).every((r) => !z.inZone(r)),
        });
      }
    }

    // t-count — exactly k of the class inside a zone, 1 ≤ k < size (0 and
    // size are t-zone's territory).
    for (const z of zones) {
      const k = ranksOf(order, a).filter(z.inZone).length;
      if (k === 0 || k === a.size) continue;
      out.push({
        kind: "t-count",
        text: `Exactly ${WORDS[k]} of the ${WORDS[a.size]} ${a.plural} rank${k === 1 ? "s" : ""} in the ${z.label}.`,
        test: (o) => ranksOf(o, a).filter(z.inZone).length === k,
      });
    }

    // t-rung — the silverback / omega is (not) a member of the class.
    for (const [rung, label] of [
      [0, "silverback"],
      [n - 1, "omega"],
    ] as const) {
      const holder = order[rung];
      if (a.members.includes(holder)) {
        out.push({
          kind: "t-rung",
          text: `The ${label} ${a.is}.`,
          test: (o) => a.members.includes(o[rung]),
        });
      } else {
        out.push({
          kind: "t-rung",
          text: `The ${label} ${a.isNot}.`,
          test: (o) => !a.members.includes(o[rung]),
        });
      }
    }

    // t-adj — a pair holds neighbouring rungs (or doesn't); a triple holds
    // three consecutive rungs.
    if (a.size === 2) {
      const [p, q] = a.members;
      const neighbours = Math.abs(rank(order, p) - rank(order, q)) === 1;
      out.push({
        kind: "t-adj",
        text: `The two ${a.plural} ${neighbours ? "hold neighbouring rungs" : "do not hold neighbouring rungs"}.`,
        test: (o) => (Math.abs(rank(o, p) - rank(o, q)) === 1) === neighbours,
      });
    } else if (a.size === 3) {
      const rs = ranksOf(order, a);
      if (Math.max(...rs) - Math.min(...rs) === 2) {
        out.push({
          kind: "t-adj",
          text: `The three ${a.plural} hold three consecutive rungs.`,
          test: (o) => {
            const r = ranksOf(o, a);
            return Math.max(...r) - Math.min(...r) === 2;
          },
        });
      }
    }

    for (const b of classes) {
      if (a === b || !disjoint(a, b)) continue;

      // t-order — every member of A outranks every member of B.
      if (Math.max(...ranksOf(order, a)) < Math.min(...ranksOf(order, b))) {
        out.push({
          kind: "t-order",
          text: `Every ${a.singular} outranks every ${b.singular}.`,
          test: (o) => Math.max(...ranksOf(o, a)) < Math.min(...ranksOf(o, b)),
        });
      }

      // t-pair — somewhere on the ladder, an A stands directly above a B.
      const pairTest = (o: readonly ApeId[]) =>
        o.some((id, i) => i + 1 < n && a.members.includes(id) && b.members.includes(o[i + 1]));
      if (pairTest(order)) {
        out.push({
          kind: "t-pair",
          text: `${capitalize(a.article)} stands directly above ${b.article}.`,
          test: pairTest,
        });
      }
    }
  }

  return out;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
