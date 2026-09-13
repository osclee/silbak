import { useEffect } from "react";
import { useGameStore } from "../state/useGameStore";
import { todayKey } from "../lib/storage";
import { Board } from "../components/Board";

export function Daily() {
  const load = useGameStore((s) => s.load);
  const dateKey = useGameStore((s) => s.dateKey);

  useEffect(() => {
    load(todayKey());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dateKey) return null;
  return <Board />;
}
