import { useRef, useState } from "react";
import type { Ape, ApeId } from "@silbak/engine";
import type { HistoryEntry, GameStatus } from "../state/useGameStore";
import { buildShareText, shareOrCopy } from "../lib/share";
import styles from "./ResultCard.module.css";

interface ResultCardProps {
  status: Exclude<GameStatus, "playing">;
  history: HistoryEntry[];
  puzzleNumber: number;
  troop: Ape[];
  revealOrder: ApeId[];
  streak: { count: number; max: number };
  isArchive: boolean;
}

export function ResultCard({ status, history, puzzleNumber, troop, revealOrder, streak, isArchive }: ResultCardProps) {
  const [label, setLabel] = useState("Copy result");
  const [failedText, setFailedText] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const solved = status === "won";
  const grid = history
    .map((entry) => entry.feedback.map((f) => (f === "exact" ? "🍌" : "🪨")).join(""))
    .join("\n");
  const shareText = buildShareText(
    history.map((h) => h.feedback),
    solved,
    puzzleNumber,
  );

  const handleCopy = async () => {
    const result = await shareOrCopy(shareText);
    if (result === "shared") {
      setLabel("Shared");
    } else if (result === "copied") {
      setLabel("Copied to clipboard");
    } else {
      setLabel("Copy result");
      setFailedText(shareText);
      requestAnimationFrame(() => textareaRef.current?.select());
    }
  };

  const apesById = new Map(troop.map((a) => [a.id, a]));

  return (
    <div className={styles.card} aria-live="polite">
      <h2 className={`${styles.headline} ${solved ? styles.won : ""}`}>
        {solved ? `Solved in ${history.length}/6` : "The troop settled without you"}
      </h2>
      <div className={styles.grid} aria-hidden="true">
        {grid}
      </div>
      {!solved && (
        <div className={styles.solution}>
          <span>True order, silverback to omega:</span>
          {revealOrder.map((id, i) => (
            <span key={id}>
              {i + 1}. {apesById.get(id)?.name}
            </span>
          ))}
        </div>
      )}
      {!isArchive && streak.count > 0 && <div className={styles.streak}>🔥 {streak.count} day streak</div>}
      <button type="button" className={styles.button} onClick={handleCopy}>
        {label}
      </button>
      {failedText !== null && (
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          readOnly
          value={failedText}
          aria-label="Result text — select and copy manually"
        />
      )}
    </div>
  );
}
