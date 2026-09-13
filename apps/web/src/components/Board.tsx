import { MAX_GUESSES, useGameStore } from "../state/useGameStore";
import { arraysEqual } from "../lib/arrays";
import { Ladder } from "./Ladder";
import { FieldNotes } from "./FieldNotes";
import { Legend } from "./Legend";
import { AttemptsHistory } from "./AttemptsHistory";
import { ResultCard } from "./ResultCard";
import styles from "./Board.module.css";

interface BoardProps {
  dateHeader?: string;
}

export function Board({ dateHeader }: BoardProps) {
  const { puzzle, arrangement, selected, history, status, streak, isArchive, revealOrder, select, submit } =
    useGameStore();

  const guessesLeft = MAX_GUESSES - history.length;
  const lastArrangement = history[history.length - 1]?.arrangement;
  const unchanged = !!lastArrangement && arraysEqual(lastArrangement, arrangement);

  return (
    <div className={styles.board}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>
          Karisoke observation log · Troop #{puzzle.number}
          {dateHeader ? ` · ${dateHeader}` : ""}
        </span>
        <h1 className={styles.title}>
          <span className={styles.titleLight}>SIL</span>
          <span className={styles.titleAccent}>BAK</span>
        </h1>
        <p className={styles.rules}>
          Six apes, one hierarchy. Tap two to swap them, then submit your ranking. Traits tell you
          something — but not everything.
        </p>
      </header>

      <FieldNotes clues={puzzle.clues} />
      <Legend />

      <Ladder
        troop={puzzle.troop}
        arrangement={arrangement}
        selected={selected}
        lastEntry={history[history.length - 1]}
        playing={status === "playing"}
        onSelect={select}
      />

      {status === "playing" ? (
        <div className={styles.controls}>
          <button type="button" className={styles.submit} onClick={submit} disabled={unchanged}>
            Submit ranking
          </button>
          <div className={styles.hintRow}>
            <span>
              {guessesLeft} guess{guessesLeft === 1 ? "" : "es"} left
            </span>
            <span>{unchanged ? "Change something first" : "Tap an ape to move it"}</span>
          </div>
        </div>
      ) : (
        <ResultCard
          status={status}
          history={history}
          puzzleNumber={puzzle.number}
          troop={puzzle.troop}
          revealOrder={revealOrder ?? []}
          streak={streak}
          isArchive={isArchive}
        />
      )}

      <AttemptsHistory history={history} troop={puzzle.troop} />
    </div>
  );
}
