import type { Feedback } from "@silbak/engine";
import { TROOP_SIZE } from "@silbak/engine";

/** "4 of 6 on their true rung." — the whole feedback language, in one line. */
export function feedbackText(f: Feedback): string {
  if (f.exact === TROOP_SIZE) return `All ${TROOP_SIZE} on their true rung.`;
  if (f.exact === 0) return "None on their true rung.";
  return `${f.exact} of ${TROOP_SIZE} on their true rung.`;
}

/** Compact badge form: "4/6". */
export function feedbackBadge(f: Feedback): string {
  return `${f.exact}/${TROOP_SIZE}`;
}
