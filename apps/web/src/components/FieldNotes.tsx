import type { Clue } from "@silbak/engine";
import styles from "./FieldNotes.module.css";

interface FieldNotesProps {
  clues: Clue[];
}

export function FieldNotes({ clues }: FieldNotesProps) {
  return (
    <section className={styles.notes} aria-labelledby="field-notes-heading">
      <div className={styles.header}>
        <span id="field-notes-heading">Field notes</span>
        <span>
          {clues.length} observation{clues.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className={styles.list}>
        {clues.map((clue, i) => (
          <li key={i} className={styles.item}>
            {clue.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
