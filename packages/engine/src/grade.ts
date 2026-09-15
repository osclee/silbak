import type { ApeId } from "./troop";
import { TROOP_SIZE, truthMap } from "./troop";

/**
 * What the troop tells you after a guess: how many apes stand on their true
 * rung. Nothing about which ones. An object rather than a bare number so a
 * second signal (e.g. the "challenges" Kendall count, see
 * docs/DIFFICULTY-2026-09-13.md Part 4) can ride alongside without changing
 * every call site.
 */
export interface Feedback {
  exact: number;
}

export interface Solution {
  order: ApeId[];
}

/**
 * Grade a guess against the solution. `guess[i]` is the ape id placed at rung i.
 *
 * Count-only, deliberately — see DESIGN.md §2 for the full history. v0.1 was
 * directional (up/down per rung) and v0.2 binary (right/wrong per rung); both
 * turned out to hand an attentive player ~4 bits a guess against a puzzle
 * that only needs ~7, so nearly every day was a two-guess game whatever the
 * clues did. A single count per guess (Mastermind's black pegs) is the one
 * feedback rule measured to move a careful solver past three guesses and to
 * produce a real Monday→Saturday curve.
 */
export function grade(guess: readonly ApeId[], solution: Solution): Feedback {
  const truth = truthMap(solution.order);
  let exact = 0;
  guess.forEach((apeId, i) => {
    if (truth[apeId] === i) exact++;
  });
  return { exact };
}

export function isSolved(feedback: Feedback): boolean {
  return feedback.exact === TROOP_SIZE;
}

/**
 * Per-rung hit mask for a guess: true at rung i if that guess had the right
 * ape there. Only used to build the share grid below — in-game feedback
 * stays the count from grade() above; see DESIGN.md §2 for why those stay
 * different (leaking this while playing would collapse the difficulty curve
 * the count-only rule was built to produce).
 */
export function gradeMask(guess: readonly ApeId[], solution: Solution): boolean[] {
  const truth = truthMap(solution.order);
  return guess.map((apeId, i) => truth[apeId] === i);
}

/**
 * Banana/rock share grid: one row per guess, banana at each rung that guess
 * had right, rock elsewhere — a positional map of the guess, not just its
 * count. No ape names, no traits — see DESIGN.md §5 ("Positional share
 * grid"). This is a deliberate, considered reveal: unlike in-game feedback,
 * the guesser already knows their own answer by share time, and a friend
 * who hasn't played can only exploit a row by also guessing that row's exact
 * arrangement — accepted as a real but bounded risk, most likely on a
 * commonly-converged-on first guess (the trait-obvious read `NOISE` is
 * tuned around).
 *
 * `par` is the weekday's expected guess count (DESIGN.md §5); a solve in one
 * earns the clean-read marker.
 */
export function shareGrid(rows: readonly boolean[][], solved: boolean, puzzleNumber: number, par: number): string {
  const score = solved ? String(rows.length) : "X";
  const cleanRead = solved && rows.length === 1 ? " 🥇" : "";
  const header = `Silbak #${puzzleNumber}  ${score}/${MAX_GUESSES} · par ${par}${cleanRead}`;
  const body = rows.map((row) => row.map((hit) => (hit ? "🍌" : "🪨")).join("")).join("\n");
  return `${header}\n${body}`;
}

/** The guess limit. Lives in the engine so the share line and the web agree. */
export const MAX_GUESSES = 6;
