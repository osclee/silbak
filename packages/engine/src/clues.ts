import type { Ape, ApeId } from "./troop";
import { TROOP_SIZE } from "./troop";

export type ClueKind = "order" | "adjacent" | "count" | "neg" | "half" | "between";

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

  // count — how many rank below a given ape.
  for (let i = 0; i < n; i++) {
    const x = order[i];
    const count = n - 1 - i;
    candidates.push({
      kind: "count",
      text: `${count} of the troop groom below ${name(x)}.`,
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
      text: `${name(x)} ranks in the top ${HALF_SPLIT}.`,
      test: (o) => rankOf(o, x) < HALF_SPLIT,
    });
  }
  for (let i = HALF_SPLIT; i < n; i++) {
    const x = order[i];
    candidates.push({
      kind: "half",
      text: `${name(x)} ranks in the bottom ${n - HALF_SPLIT}.`,
      test: (o) => rankOf(o, x) >= HALF_SPLIT,
    });
  }

  // between — strict triples.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const x = order[i];
        const y = order[j];
        const z = order[k];
        candidates.push({
          kind: "between",
          text: `${name(y)} ranks somewhere between ${name(x)} and ${name(z)}.`,
          test: (o) => rankOf(o, x) < rankOf(o, y) && rankOf(o, y) < rankOf(o, z),
        });
      }
    }
  }

  return candidates;
}
