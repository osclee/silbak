import type { ApeId } from "./troop";
import { truthMap } from "./troop";

export type FeedbackSignal = "exact" | "wrong";

export interface Solution {
  order: ApeId[];
}

/**
 * Grade a guess against the solution. `guess[i]` is the ape id placed at rung i.
 * Deliberately non-directional — see DESIGN.md §2: earlier versions returned
 * up/down, but that told an optimal solver almost everything in 1-2 guesses
 * regardless of clue-phase difficulty. Dropping direction is what actually
 * moves the needle on guesses-to-solve.
 */
export function grade(guess: readonly ApeId[], solution: Solution): FeedbackSignal[] {
  const truth = truthMap(solution.order);
  return guess.map((apeId, i) => (truth[apeId] === i ? "exact" : "wrong"));
}

export function isSolved(feedback: readonly FeedbackSignal[]): boolean {
  return feedback.every((f) => f === "exact");
}

/**
 * Banana/rock share grid. No arrows, no names — see DESIGN.md §5: directional
 * glyphs would leak the answer's shape to anyone who hasn't played.
 */
export function shareGrid(history: readonly FeedbackSignal[][], solved: boolean, puzzleNumber: number): string {
  const header = `Silbak #${puzzleNumber}  ${solved ? history.length : "X"}/6`;
  const rows = history.map((row) => row.map((f) => (f === "exact" ? "🍌" : "🪨")).join("")).join("\n");
  return `${header}\n${rows}`;
}
