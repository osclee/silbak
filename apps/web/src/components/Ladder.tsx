import { useLayoutEffect, useRef } from "react";
import type { Ape, ApeId } from "@silbak/engine";
import { Rung } from "./Rung";
import styles from "./Ladder.module.css";
// The swap is animated imperatively (see the FLIP below), so the one class it
// paints on a rung mid-flight is reached for here rather than passed as a prop.
import rungStyles from "./Rung.module.css";

interface LadderProps {
  troop: Ape[];
  arrangement: ApeId[];
  selected: number | null;
  playing: boolean;
  onSelect: (index: number) => void;
}

/** Swap flight time. Deliberately slower than --motion-fast (the selection
 *  change, which should feel instant under the finger) and in the
 *  --motion-medium band: the swap is the one move a player makes on the board,
 *  so it has to be legible as "these two traded places", not just acknowledged. */
const SWAP_MS = 260;

/** How far out of the column each rung leans mid-flight, so the two cards read
 *  as going *around* each other instead of straight through each other. The
 *  board keeps 16px of padding (Board.module.css), so this can't push a card
 *  off the edge of a phone screen. */
const SWAP_LEAN_PX = 10;

/** The global `*` rule in global.css only collapses CSS animations and
 *  transitions; a Web Animations API animation is invisible to it, so the swap
 *  flight has to opt out by hand. Doubles as the guard for environments with no
 *  WAAPI at all, where the swap simply happens instantly. */
function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof Element.prototype.animate !== "function") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function Ladder({ troop, arrangement, selected, playing, onSelect }: LadderProps) {
  const apesById = new Map(troop.map((a) => [a.id, a]));

  const nodes = useRef(new Map<ApeId, HTMLButtonElement>());
  const flights = useRef(new Map<ApeId, Animation>());
  /** Rung positions captured in the click handler, i.e. *before* the store
   *  reorders `arrangement` — the "First" half of a FLIP. Null on every render
   *  a tap didn't cause, so nothing else that reflows the ladder (feedback
   *  landing, a resize, a new puzzle loading) can be mistaken for a swap. */
  const beforeTops = useRef<Map<ApeId, number> | null>(null);

  function handleSelect(index: number) {
    const tops = new Map<ApeId, number>();
    // offsetTop rather than getBoundingClientRect(): it's a layout box, so it
    // is immune both to page scroll and to a transform still running on a rung
    // from a swap the player interrupted.
    for (const [id, el] of nodes.current) tops.set(id, el.offsetTop);
    beforeTops.current = tops;
    onSelect(index);
  }

  useLayoutEffect(() => {
    const before = beforeTops.current;
    beforeTops.current = null;
    if (!before || !motionAllowed()) return;

    for (const [id, el] of nodes.current) {
      const from = before.get(id);
      if (from === undefined) continue;
      const dy = from - el.offsetTop;
      if (dy === 0) continue; // a plain select moves nothing

      flights.current.get(id)?.cancel();
      // The rung climbing the ladder lifts over the top — in front, swollen
      // slightly, casting a shadow; the one going down dips behind it. Without
      // that the two cards would slide through each other along the same line
      // and the swap would read as a flicker.
      const rising = dy > 0;
      el.style.zIndex = rising ? "2" : "1";
      if (rising) el.classList.add(rungStyles.lifted);
      const flight = el.animate(
        [
          { transform: `translate(0px, ${dy}px)` },
          {
            transform: `translate(${rising ? -SWAP_LEAN_PX : SWAP_LEAN_PX}px, ${dy / 2}px) scale(${
              rising ? 1.04 : 0.97
            })`,
            offset: 0.5,
          },
          { transform: "translate(0px, 0px) scale(1)" },
        ],
        // Symmetric ease-in-out, so the cards are at their widest apart exactly
        // at the halfway point and the pass reads as one gesture. An ease-out
        // front-loads the whole crossing into the first quarter and then drags.
        { duration: SWAP_MS, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
      );
      flights.current.set(id, flight);

      const settle = () => {
        if (flights.current.get(id) !== flight) return; // a newer swap owns this rung now
        flights.current.delete(id);
        el.style.zIndex = "";
        el.classList.remove(rungStyles.lifted);
      };
      flight.addEventListener("finish", settle);
      flight.addEventListener("cancel", settle);
    }
  });

  return (
    <div className={styles.ladder} aria-label="Ape ladder, silverback at top">
      {arrangement.map((apeId, i) => {
        const ape = apesById.get(apeId);
        if (!ape) return null;
        return (
          <Rung
            key={apeId}
            ref={(el) => {
              if (el) nodes.current.set(apeId, el);
              else nodes.current.delete(apeId);
            }}
            index={i}
            total={arrangement.length}
            ape={ape}
            selected={selected === i}
            disabled={!playing}
            onSelect={() => handleSelect(i)}
          />
        );
      })}
    </div>
  );
}
