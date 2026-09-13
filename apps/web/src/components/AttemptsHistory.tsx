import type { Ape } from "@silbak/engine";
import type { HistoryEntry } from "../state/useGameStore";
import { feedbackGlyph } from "../lib/feedback";
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

export function AttemptsHistory({ history, troop }: AttemptsHistoryProps) {
  if (history.length === 0) return null;
  const apesById = new Map(troop.map((a) => [a.id, a]));
  return (
    <div className={styles.attempts} aria-label="Attempt history">
      {history.map((entry, i) => (
        <div className={styles.row} key={i}>
          <span className={styles.rowLabel}>#{i + 1}</span>
          <div className={styles.cells}>
            {entry.arrangement.map((apeId, j) => {
              const ape = apesById.get(apeId);
              const f = entry.feedback[j];
              return (
                <span className={styles.cell} key={apeId}>
                  <span className={styles.cellName}>{ape ? shortName(ape.name) : "?"}</span>
                  <span className={`${styles.cellGlyph} ${styles[f]}`}>{feedbackGlyph(f)}</span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
