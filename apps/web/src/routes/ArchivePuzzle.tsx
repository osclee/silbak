import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { EPOCH } from "@silbak/engine";
import { useGameStore } from "../state/useGameStore";
import { dateKeyFromPuzzleNumber } from "../lib/puzzle";
import { Board } from "../components/Board";

export function ArchivePuzzle() {
  const { number } = useParams<{ number: string }>();
  const load = useGameStore((s) => s.load);
  const dateKey = useGameStore((s) => s.dateKey);
  const n = Number(number);

  useEffect(() => {
    if (Number.isFinite(n) && n >= 1) {
      load(dateKeyFromPuzzleNumber(EPOCH, n), { archive: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  if (!Number.isFinite(n) || n < 1) return <Navigate to="/archive" replace />;
  if (!dateKey) return null;
  return <Board dateHeader={dateKeyFromPuzzleNumber(EPOCH, n)} />;
}
