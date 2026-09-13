import { hashStr, mulberry32 } from "./rng";
import type { Ape, ApeId } from "./troop";
import { buildTroop, computeTrueOrder, TROOP_SIZE } from "./troop";
import { candidateClues } from "./clues";
import type { Clue } from "./clues";
import { selectClues, bandForDateKey } from "./select";
import { allPermutations } from "./permutations";
import { ENGINE_VERSION, EPOCH, puzzleNumber } from "./version";
import type { Solution, FeedbackSignal } from "./grade";
import { grade, isSolved, shareGrid } from "./grade";

export { ENGINE_VERSION, EPOCH, puzzleNumber, grade, isSolved, shareGrid, TROOP_SIZE };
export type { Ape, ApeId, Age, Build, Silver } from "./troop";
export type { Clue, ClueKind } from "./clues";
export type { Solution, FeedbackSignal } from "./grade";
export type { Band } from "./select";
export { bandForDateKey } from "./select";

export interface Puzzle {
  number: number;
  dateKey: string;
  engineVersion: number;
  troop: Ape[];
  clues: Clue[];
  space: number;
}

/**
 * Pure and deterministic: same dateKey always yields the same puzzle, on any
 * device, forever. No network, no clock beyond the date, no Math.random.
 */
export function generate(dateKey: string): Puzzle & { solution: Solution } {
  const seed = hashStr(`silbak::v${ENGINE_VERSION}::${dateKey}`);
  const rng = mulberry32(seed);

  const troop = buildTroop(rng);
  const trueOrder = computeTrueOrder(troop, rng);
  const allPerms = allPermutations() as ApeId[][];
  const candidates = candidateClues(trueOrder, troop);
  const band = bandForDateKey(dateKey);
  const { clues, space } = selectClues(candidates, allPerms, band, rng);

  return {
    number: puzzleNumber(dateKey),
    dateKey,
    engineVersion: ENGINE_VERSION,
    troop,
    clues,
    space,
    solution: { order: trueOrder },
  };
}

/** Strips the solution so the client bundle never accidentally renders it. */
export function stripSolution(puzzle: Puzzle & { solution: Solution }): Puzzle {
  const { solution: _solution, ...rest } = puzzle;
  return rest;
}
