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
    </button>
  );
});
