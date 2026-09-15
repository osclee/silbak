import { useRef, useState } from "react";
import { MAX_GUESSES } from "@silbak/engine";
import type { Ape, ApeId } from "@silbak/engine";
import type { HistoryEntry, GameStatus } from "../state/useGameStore";
import { buildShareText, shareOrCopy } from "../lib/share";
import { loadPersisted, todayKey } from "../lib/storage";
import { computeStats, describeVsPar, formatVsPar } from "../lib/stats";
import styles from "./ResultCard.module.css";

interface ResultCardProps {
  status: Exclude<GameStatus, "playing">;
  history: HistoryEntry[];
  puzzleNumber: number;
  par: number;
  troop: Ape[];
  revealOrder: ApeId[];
  streak: { count: number; max: number };
  isArchive: boolean;
}

export function ResultCard({
  status,
  history,
  puzzleNumber,
  par,
  troop,
  revealOrder,
  streak,
  isArchive,
}: ResultCardProps) {
  const [label, setLabel] = useState("Copy result");
  const [failedText, setFailedText] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const solved = status === "won";
  const cleanRead = solved && history.length === 1;
  // Positional per rung — the guesser already knows their own answer by
  // share time; see grade.ts's shareGrid doc comment for the accepted
  // leak-to-other-players tradeoff this was weighed against.
  const rows = history.map((entry) => entry.arrangement.map((apeId, i) => apeId === revealOrder[i]));
  const grid = rows.map((row) => row.map((hit) => (hit ? "🍌" : "🪨")).join("")).join("\n");
  const shareText = buildShareText(rows, solved, puzzleNumber, par);

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
  // Read at render, not subscribed: the terminal submit that mounted this
  // card has already written today's entry, and nothing else changes it.
  const stats = isArchive ? null : computeStats(loadPersisted().played, todayKey());

  return (
    <div className={styles.card} aria-live="polite">
      <h2 className={`${styles.headline} ${solved ? styles.won : ""}`}>
        {solved ? `Solved in ${history.length}/${MAX_GUESSES}` : "The troop settled without you"}
      </h2>
      <p className={styles.par}>
        {cleanRead ? (
          <>
            <span className={styles.medal} aria-hidden="true">
              🥇
            </span>{" "}
            Clean read — one guess, par {par}
          </>
        ) : solved ? (
          `${describeVsPar(history.length - par)} · par ${par}`
        ) : (
          `Unsolved · par ${par}`
        )}
      </p>
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
      {stats && (
        <dl className={styles.stats}>
          <div>
            <dt>Played</dt>
            <dd>{stats.played}</dd>
          </div>
          <div>
            <dt>Won</dt>
            <dd>{stats.played ? Math.round((100 * stats.won) / stats.played) : 0}%</dd>
          </div>
          <div>
            <dt>Streak</dt>
            <dd>{streak.count}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd>{streak.max}</dd>
          </div>
          <div>
            <dt>vs par · {stats.monthLabel}</dt>
            <dd>{formatVsPar(stats.vsParMonth)}</dd>
          </div>
        </dl>
      )}
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
