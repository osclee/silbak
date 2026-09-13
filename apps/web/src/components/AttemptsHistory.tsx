import type { HistoryEntry } from "../state/useGameStore";
import { feedbackGlyph } from "../lib/feedback";
import styles from "./AttemptsHistory.module.css";

interface AttemptsHistoryProps {
  history: HistoryEntry[];
}

export function AttemptsHistory({ history }: AttemptsHistoryProps) {
  if (history.length === 0) return null;
  return (
    <div className={styles.attempts} aria-label="Attempt history">
      {history.map((entry, i) => (
        <div className={styles.chip} key={i}>
          <span>#{i + 1}</span>
          {entry.feedback.map((f, j) => (
            <span key={j} className={`${styles.cell} ${styles[f]}`}>
              {feedbackGlyph(f)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
