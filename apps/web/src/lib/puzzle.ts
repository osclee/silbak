import { generate, stripSolution } from "@silbak/engine";
import type { Puzzle, Solution } from "@silbak/engine";

/**
 * The one place `Solution` is allowed to exist in the web app. Every caller
 * beyond this boundary receives a solution-free `Puzzle` — no component can
 * accidentally render the answer.
 */
export function loadPuzzle(dateKey: string): { puzzle: Puzzle; solution: Solution } {
  const full = generate(dateKey);
  return { puzzle: stripSolution(full), solution: full.solution };
}

export function dateKeyFromPuzzleNumber(epoch: string, number: number): string {
  const d = new Date(`${epoch}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (number - 1));
  return d.toISOString().slice(0, 10);
}
