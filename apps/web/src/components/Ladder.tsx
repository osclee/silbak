import type { Ape, ApeId } from "@silbak/engine";
import type { HistoryEntry } from "../state/useGameStore";
import { Rung } from "./Rung";
import styles from "./Ladder.module.css";

interface LadderProps {
  troop: Ape[];
  arrangement: ApeId[];
  selected: number | null;
  lastEntry?: HistoryEntry;
  playing: boolean;
  onSelect: (index: number) => void;
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function Ladder({ troop, arrangement, selected, lastEntry, playing, onSelect }: LadderProps) {
  const apesById = new Map(troop.map((a) => [a.id, a]));
  const showFeedback = lastEntry && arraysEqual(lastEntry.arrangement, arrangement);

  return (
    <div className={styles.ladder} role="list" aria-label="Ape ladder, silverback at top">
      {arrangement.map((apeId, i) => {
        const ape = apesById.get(apeId);
        if (!ape) return null;
        return (
          <Rung
            key={apeId}
            index={i}
            total={arrangement.length}
            ape={ape}
            feedback={showFeedback ? lastEntry!.feedback[i] : undefined}
            selected={selected === i}
            disabled={!playing}
            onSelect={() => onSelect(i)}
          />
        );
      })}
    </div>
  );
}
