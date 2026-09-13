import { forwardRef } from "react";
import type { Ape, FeedbackSignal } from "@silbak/engine";
import { ApeGlyph } from "./ApeGlyph";
import { feedbackGlyph, feedbackLabel } from "../lib/feedback";
import { formatSilver } from "../lib/traits";
import styles from "./Rung.module.css";

interface RungProps {
  index: number;
  total: number;
  ape: Ape;
  feedback?: FeedbackSignal;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

// Aria wording (semantic) vs. the on-tile badge text (visual) are intentionally
// separate. Only rung 1 and the last rung get a name; everything in between is
// a zero-padded number, regardless of troop size.
function positionName(index: number, total: number): string {
  if (index === 0) return "silverback";
  if (index === total - 1) return "omega";
  return "";
}

function rankBadge(index: number, total: number): string {
  const name = positionName(index, total);
  return name || String(index + 1).padStart(2, "0");
}

// The ladder measures and animates these buttons directly (Ladder.tsx's FLIP
// swap), which is why the DOM node is forwarded rather than kept private.
export const Rung = forwardRef<HTMLButtonElement, RungProps>(function Rung(
  { index, total, ape, feedback, selected, disabled, onSelect },
  ref,
) {
  const posName = positionName(index, total);
  const ariaLabel = [
    `Rung ${index + 1}${posName ? `, ${posName}` : ""}: ${ape.name}`,
    `${ape.age}, ${ape.build} build, ${formatSilver(ape.silver)}${ape.scar ? ", scarred" : ""}`,
    // feedbackLabel() carries its own full stop, which the join would double up
    // now that a clause can follow it.
    feedback ? feedbackLabel(feedback).replace(/\.$/, "") : "",
    // Additive, not an alternative to the feedback clause: a rung can be picked
    // up while last guess's feedback is still on the board, and "selected" is
    // the half a screen-reader user can't see.
    selected ? "Selected, choose another ape to swap with" : "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.rung} ${selected ? styles.selected : ""}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={ariaLabel}
    >
      <span className={styles.rank} aria-hidden="true">
        {rankBadge(index, total)}
      </span>
      <span className={styles.portrait}>
        <ApeGlyph id={ape.id} age={ape.age} build={ape.build} silver={ape.silver} scar={ape.scar} size={56} />
      </span>
      <span className={styles.info}>
        <span className={styles.name}>{ape.name}</span>
        <span className={styles.traits}>
          {ape.age} · {ape.build} · {formatSilver(ape.silver)}
          {ape.scar ? " · scarred" : ""}
        </span>
      </span>
      <span className={`${styles.feedback} ${feedback ? styles[feedback] : ""}`} aria-hidden="true">
        {feedback ? feedbackGlyph(feedback) : ""}
      </span>
    </button>
  );
});
