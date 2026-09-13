import { useEffect } from "react";
import { useGameStore } from "../state/useGameStore";
import { todayKey } from "../lib/storage";
import { Board } from "../components/Board";

// The store's `load()` handles rollover, but an already-open tab never calls it
// again on its own — without this, a tab left open across local midnight keeps
// showing yesterday's puzzle indefinitely.
const ROLLOVER_CHECK_MS = 60_000;

export function Daily() {
  const load = useGameStore((s) => s.load);
  const dateKey = useGameStore((s) => s.dateKey);

  useEffect(() => {
    load(todayKey());

    const checkRollover = () => {
      const today = todayKey();
      if (today !== useGameStore.getState().dateKey) load(today);
    };
    document.addEventListener("visibilitychange", checkRollover);
    window.addEventListener("focus", checkRollover);
    const interval = window.setInterval(checkRollover, ROLLOVER_CHECK_MS);

    return () => {
      document.removeEventListener("visibilitychange", checkRollover);
      window.removeEventListener("focus", checkRollover);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dateKey) return null;
  return <Board />;
}
