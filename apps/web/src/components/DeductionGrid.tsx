import type { Ape, ApeId } from "@silbak/engine";
import type { Marks } from "../lib/storage";
import { markKey } from "../state/useGameStore";
import styles from "./DeductionGrid.module.css";

interface DeductionGridProps {
  troop: Ape[];
  marks: Marks;
  playing: boolean;
  onCycle: (apeId: ApeId, rung: number) => void;
}

// Matches AttemptsHistory's short form so an ape reads the same in both.
function shortName(name: string): string {
  return name.slice(0, 4).toUpperCase();
}

const GLYPH = { no: "✗", yes: "✓" } as const;
const LABEL = { no: "ruled out", yes: "confirmed" } as const;

/**
 * The player's ledger: one cell per ape × rung, cycling blank → ✗ → ✓ on
 * tap. Nothing here is checked against the solution — it is the equivalent
 * of Wordle's coloured keyboard, a place to write down what the counts have
 * let you infer, because count-only feedback makes elimination a matter of
 * intersecting guesses rather than reading a glyph off a rung. The store
 * fills in the one mechanical case (a guess scoring 0 rules out every ape on
 * it); everything else is the player's.
 */
export function DeductionGrid({ troop, marks, playing, onCycle }: DeductionGridProps) {
  const rungs = troop.map((_, i) => i);
  return (
    <section className={styles.ledger} aria-labelledby="ledger-heading">
      <div className={styles.header}>
        <span id="ledger-heading">Ledger</span>
        <span>tap: ✗ ruled out · ✓ confirmed</span>
      </div>
      <div className={styles.grid} role="grid" aria-label="Ape by rung ledger" aria-readonly={!playing}>
        <div className={styles.corner} role="columnheader" aria-label="Ape">
          rung
        </div>
        {rungs.map((r) => (
          <div key={r} className={styles.colHead} role="columnheader">
            {r + 1}
          </div>
        ))}
        {troop.map((ape) => (
          <div key={ape.id} className={styles.row} role="row">
            <div className={styles.rowHead} role="rowheader" title={ape.name}>
              {shortName(ape.name)}
            </div>
            {rungs.map((r) => {
              const mark = marks[markKey(ape.id, r)];
              return (
                <button
                  key={r}
                  type="button"
                  role="gridcell"
                  className={`${styles.cell} ${mark ? styles[mark] : ""}`}
                  onClick={() => onCycle(ape.id, r)}
                  disabled={!playing}
                  aria-label={`${ape.name} at rung ${r + 1}: ${mark ? LABEL[mark] : "unmarked"}`}
                >
                  {mark ? GLYPH[mark] : ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className={styles.footnote}>Rung 1 is the silverback, rung 6 the omega.</p>
    </section>
  );
}
