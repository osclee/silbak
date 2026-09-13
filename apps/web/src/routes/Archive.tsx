import { Link } from "react-router-dom";
import { EPOCH, puzzleNumber } from "@silbak/engine";
import { todayKey, loadPersisted } from "../lib/storage";
import { dateKeyFromPuzzleNumber } from "../lib/puzzle";
import styles from "./Archive.module.css";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${WEEKDAY[d.getDay()]} · ${dateKey}`;
}

export function Archive() {
  const current = puzzleNumber(todayKey());
  const { played } = loadPersisted();
  // Today lives at "/" (ArchivePuzzle redirects it there) — the archive is
  // everything that came before it.
  const numbers = Array.from({ length: Math.min(current - 1, 60) }, (_, i) => current - 1 - i);

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Archive</h1>
      <p className={styles.note}>Past puzzles. Playing here doesn't affect your streak.</p>
      <ul className={styles.list}>
        {numbers.map((n) => {
          const result = played[n];
          return (
            <li key={n}>
              <Link to={`/archive/${n}`} className={styles.link}>
                <span className={styles.info}>
                  <span className={styles.number}>Troop #{n}</span>
                  <span className={styles.date}>{formatDate(dateKeyFromPuzzleNumber(EPOCH, n))}</span>
                </span>
                {result && (
                  <span className={styles.result}>
                    {result.solved ? "🍌" : "🪨"} {result.guesses}/6
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
