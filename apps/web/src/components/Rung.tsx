import { forwardRef, type DragEvent } from "react";
import type { Ape } from "@silbak/engine";
import { ApeGlyph } from "./ApeGlyph";
import { formatSilver } from "../lib/traits";
import styles from "./Rung.module.css";

interface RungProps {
  index: number;
  total: number;
  ape: Ape;
  selected: boolean;
  disabled?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onSelect: () => void;
  onDragStart?: (e: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLButtonElement>) => void;
  onDragOver?: (e: DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: (e: DragEvent<HTMLButtonElement>) => void;
  onDrop?: (e: DragEvent<HTMLButtonElement>) => void;
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

/** The visible trait line, in DESIGN.md §6's reading order: age, build,
 *  silvering, then the scar if there is one. */
function traitList(ape: Ape): string[] {
  const traits = [ape.age, ape.build, formatSilver(ape.silver)];
  return ape.scar ? [...traits, "scarred"] : traits;
}

// The ladder measures and animates these buttons directly (Ladder.tsx's FLIP
// swap), which is why the DOM node is forwarded rather than kept private.
export const Rung = forwardRef<HTMLButtonElement, RungProps>(function Rung(
  {
    index,
    total,
    ape,
    selected,
    disabled,
    dragging,
    dropTarget,
    onSelect,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
  },
  ref,
) {
  const posName = positionName(index, total);
  const ariaLabel = [
    `Rung ${index + 1}${posName ? `, ${posName}` : ""}: ${ape.name}`,
    `${ape.age}, ${ape.build} build, ${formatSilver(ape.silver)}${ape.scar ? ", scarred" : ""}`,
    // "Selected" is the half a screen-reader user can't see.
    selected ? "Selected, choose another ape to swap with" : "",
  ]
    .filter(Boolean)
    .join(". ");

  const className = [
    styles.rung,
    selected ? styles.selected : "",
    dragging ? styles.dragging : "",
    dropTarget ? styles.dropTarget : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={ariaLabel}
      // Native HTML5 drag-and-drop — an addition to tap-to-swap, which stays
      // the primary input (DESIGN.md §"Interaction") and keeps working on
      // touch and keyboard where drag isn't available.
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Two badges, one of which is always display:none. The word form
          ("SILVERBACK") needs a 12ch column, which is 25% of a 390px phone
          spent on a label the rules line and the ledger both already state; the
          numeral form is the same information at 2.5ch. Both are aria-hidden
          and neither is load-bearing — `ariaLabel` above carries "Rung 1,
          silverback" at every width, so the narrow layout costs a screen-reader
          user nothing. */}
      <span className={styles.rank} aria-hidden="true">
        {rankBadge(index, total)}
      </span>
      <span className={styles.rankCompact} aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className={styles.portrait}>
        <ApeGlyph id={ape.id} age={ape.age} build={ape.build} silver={ape.silver} scar={ape.scar} size={56} />
      </span>
      <span className={styles.info}>
        <span className={styles.name}>{ape.name}</span>
        {/* The separators are real elements rather than literal " · " text so
            their width is a style, not content. The longest trait string in the
            game ("subadult · slight · no silver · scarred") overruns the info
            column on a 375px phone with desktop spacing and wraps to a second
            line, which is what made rung heights ragged; the narrow-viewport
            rule in the stylesheet tightens the separators instead of truncating
            any of the words, each of which is a clue. */}
        <span className={styles.traits}>
          {traitList(ape).map((trait, i) => (
            <span key={trait}>
              {i > 0 && (
                <span className={styles.sep} aria-hidden="true">
                  ·
                </span>
              )}
              {trait}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
});
