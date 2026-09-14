import { MAX_GUESSES, useGameStore } from "../state/useGameStore";
import { arraysEqual } from "../lib/arrays";
import { feedbackText } from "../lib/feedback";
import { Ladder } from "./Ladder";
import { FieldNotes } from "./FieldNotes";
import { DeductionGrid } from "./DeductionGrid";
import { AttemptsHistory } from "./AttemptsHistory";
import { ResultCard } from "./ResultCard";
import styles from "./Board.module.css";

interface BoardProps {
  dateHeader?: string;
}

export function Board({ dateHeader }: BoardProps) {
  const {
    puzzle,
    arrangement,
    selected,
    history,
    status,
    streak,
    isArchive,
    revealOrder,
    marks,
    select,
    submit,
    cycleMark,
  } = useGameStore();

  const guessesLeft = MAX_GUESSES - history.length;
  const lastEntry = history[history.length - 1];
  const unchanged = !!lastEntry && arraysEqual(lastEntry.arrangement, arrangement);
  const playing = status === "playing";

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
          Six apes, one hierarchy — rung 1 is the silverback, rung 6 the omega. Tap two to swap them,
          then submit. After each guess the troop tells you <em>how many</em> apes stand on their true
          rung — not which ones. Traits tell you something, but not everything.
        </p>
      </header>

      <FieldNotes clues={puzzle.clues} />

      <Ladder troop={puzzle.troop} arrangement={arrangement} selected={selected} playing={playing} onSelect={select} />

      {/* The verdict on the last guess. Tied to the arrangement it graded:
          once the board changes it stays visible but steps back, since the
          count no longer describes what's on the ladder. The history rows
          keep the permanent record. */}
      {lastEntry && (
        <div className={`${styles.verdict} ${unchanged ? "" : styles.verdictStale}`}>
          <span className={styles.verdictLabel}>Guess {history.length}</span>
          <span className={styles.verdictText}>{feedbackText(lastEntry.feedback)}</span>
          {!unchanged && <span className={styles.verdictNote}>board changed since</span>}
        </div>
      )}
      <div className={styles.srOnly} aria-live="polite">
        {lastEntry ? `Guess ${history.length}: ${feedbackText(lastEntry.feedback)}` : ""}
      </div>

      {playing ? (
        <div className={styles.controls}>
          <button type="button" className={styles.submit} onClick={submit} disabled={unchanged}>
            Submit ranking
          </button>
          <div className={styles.hintRow}>
            <span>
              {guessesLeft} guess{guessesLeft === 1 ? "" : "es"} left · par {puzzle.par}
            </span>
            <span>{unchanged ? "Change something first" : "Tap an ape to move it"}</span>
          </div>
        </div>
      ) : (
        <ResultCard
          status={status}
          history={history}
          puzzleNumber={puzzle.number}
          par={puzzle.par}
          troop={puzzle.troop}
          revealOrder={revealOrder ?? []}
          streak={streak}
          isArchive={isArchive}
        />
      )}

      <DeductionGrid troop={puzzle.troop} marks={marks} playing={playing} onCycle={cycleMark} />

      <AttemptsHistory history={history} troop={puzzle.troop} />
    </div>
  );
}
