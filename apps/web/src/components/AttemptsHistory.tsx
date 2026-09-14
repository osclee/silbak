import type { Ape } from "@silbak/engine";
import type { HistoryEntry } from "../state/useGameStore";
import { feedbackBadge, feedbackText } from "../lib/feedback";
import styles from "./AttemptsHistory.module.css";

interface AttemptsHistoryProps {
  history: HistoryEntry[];
  troop: Ape[];
}

// Full names don't fit six-to-a-row at 375px; the first four letters are
// still enough to tell apart the troop's short, distinct names.
function shortName(name: string): string {
  return name.slice(0, 4).toUpperCase();
}

/**
 * Each past arrangement plus its count. With count-only feedback this is the
 * primary deduction surface: "guess 2 had Kanzi at 3 and scored 1; guess 3
 * moved only Kanzi and scored 0" is a fact about a rung, and it is only
 * recoverable if both arrangements are still on screen.
 */
export function AttemptsHistory({ history, troop }: AttemptsHistoryProps) {
  if (history.length === 0) return null;
  const apesById = new Map(troop.map((a) => [a.id, a]));
  return (
    <div className={styles.attempts} aria-label="Attempt history">
      {history.map((entry, i) => (
        <div className={styles.row} key={i}>
          <span className={styles.rowLabel}>#{i + 1}</span>
          <div className={styles.cells}>
            {entry.arrangement.map((apeId) => {
              const ape = apesById.get(apeId);
              return (
                <span className={styles.cell} key={apeId}>
                  {ape ? shortName(ape.name) : "?"}
                </span>
              );
            })}
          </div>
          <span
            className={`${styles.badge} ${entry.feedback.exact > 0 ? styles.some : ""}`}
            aria-label={feedbackText(entry.feedback)}
          >
            {feedbackBadge(entry.feedback)}
          </span>
        </div>
      ))}
    </div>
  );
}
