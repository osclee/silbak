import { Link } from "react-router-dom";
import { EPOCH, puzzleNumber } from "@silbak/engine";
import { todayKey } from "../lib/storage";
import styles from "./Archive.module.css";

export function Archive() {
  const current = puzzleNumber(todayKey());
  const numbers = Array.from({ length: Math.min(current, 60) }, (_, i) => current - i);

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Archive</h1>
      <p className={styles.note}>Past puzzles. Playing here doesn't affect your streak.</p>
      <ul className={styles.list}>
        {numbers.map((n) => (
          <li key={n}>
            <Link to={`/archive/${n}`} className={styles.link}>
              Troop #{n}
              {n === current ? " (today)" : ""}
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        Silbak epoch: {EPOCH}
      </p>
    </div>
  );
}
