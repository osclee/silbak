import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { EPOCH, puzzleNumber } from "@silbak/engine";
import { useGameStore } from "../state/useGameStore";
import { dateKeyFromPuzzleNumber } from "../lib/puzzle";
import { todayKey } from "../lib/storage";
import { Board } from "../components/Board";

// Past this, `dateKeyFromPuzzleNumber` is producing dates far enough out that
// nothing meaningful is being tested — just a guard against feeding
// `Date#toISOString` an out-of-range value and crashing with a white screen.
const MAX_ARCHIVE_NUMBER = 100_000;

export function ArchivePuzzle() {
  const { number } = useParams<{ number: string }>();
  const load = useGameStore((s) => s.load);
  const dateKey = useGameStore((s) => s.dateKey);
  const n = Number(number);
  const current = puzzleNumber(todayKey());
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_ARCHIVE_NUMBER && n < current;

  useEffect(() => {
    if (valid) {
      load(dateKeyFromPuzzleNumber(EPOCH, n), { archive: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, valid]);

  // Today and any future puzzle redirect home rather than leak via the archive;
  // anything else invalid (non-integer, zero, negative, absurdly large) goes
  // back to the archive list instead.
  if (!valid) return <Navigate to={n === current ? "/" : "/archive"} replace />;
  if (!dateKey) return null;
  return <Board dateHeader={dateKeyFromPuzzleNumber(EPOCH, n)} />;
}
