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
 * Banana/rock share grid: one row per guess, `exact` bananas then rocks. No
 * arrows, no names — see DESIGN.md §5. A count row reveals strictly less than
 * the old per-rung row did (only *how many*, never *which*), so the format
 * is safer to share than it was, not just unchanged.
 *
 * `par` is the weekday's expected guess count (DESIGN.md §5); a solve in one
 * earns the clean-read marker.
 */
export function shareGrid(
  history: readonly Feedback[],
  solved: boolean,
  puzzleNumber: number,
  par: number,
): string {
  const score = solved ? String(history.length) : "X";
  const cleanRead = solved && history.length === 1 ? " 🥇" : "";
  const header = `Silbak #${puzzleNumber}  ${score}/${MAX_GUESSES} · par ${par}${cleanRead}`;
  const rows = history.map((f) => "🍌".repeat(f.exact) + "🪨".repeat(TROOP_SIZE - f.exact)).join("\n");
  return `${header}\n${rows}`;
}

/** The guess limit. Lives in the engine so the share line and the web agree. */
export const MAX_GUESSES = 6;
