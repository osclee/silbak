/**
 * Headless playtest harness. Lets a player (human or agent) play a puzzle
 * blind — troop + clues only, never the solution — and get real grade()
 * feedback per guess, without needing a browser.
 *
 * Usage (from packages/engine):
 *   npx tsx scripts/playtest-cli.ts info <puzzleNumber>
 *   npx tsx scripts/playtest-cli.ts guess <puzzleNumber> <id0,id1,...>
 *
 * `info` prints the puzzle (troop with names/traits, clues, band info) as
 * JSON — the solution field is stripped before printing. `guess` takes a
 * comma-separated permutation of ape ids (0..TROOP_SIZE-1, one each) and
 * prints the real grade() feedback plus whether it solved the puzzle. Each
 * invocation is a fresh process; puzzles are regenerated deterministically
 * from the puzzle number each time (generation is pure), so there's no state
 * file and no way to peek at the solution short of computing it yourself.
 */
import { generate } from "../src/index";
import { EPOCH } from "../src/version";
import { grade, isSolved } from "../src/grade";
import type { ApeId } from "../src/troop";
import { TROOP_SIZE } from "../src/troop";

function dateKeyFromPuzzleNumber(n: number): string {
  const d = new Date(`${EPOCH}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (n - 1));
  return d.toISOString().slice(0, 10);
}

function fail(msg: string): never {
  console.error(JSON.stringify({ error: msg }));
  process.exit(1);
}

function parsePuzzleNumber(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
    fail(`invalid puzzle number: ${raw}`);
  }
  return n;
}

const [, , command, ...rest] = process.argv;

if (command === "info") {
  const n = parsePuzzleNumber(rest[0]);
  const dateKey = dateKeyFromPuzzleNumber(n);
  const full = generate(dateKey);
  const { solution: _solution, ...puzzle } = full;
  console.log(JSON.stringify(puzzle, null, 2));
} else if (command === "guess") {
  const n = parsePuzzleNumber(rest[0]);
  const idsArg = rest[1];
  const usage = `id0,${Array.from({ length: TROOP_SIZE - 1 }, (_, i) => `id${i + 1}`).join(",")}`;
  if (!idsArg) fail(`usage: guess <puzzleNumber> <${usage}>`);

  const parts = idsArg.split(",").map((s) => Number(s.trim()));
  if (parts.length !== TROOP_SIZE || parts.some((v) => !Number.isInteger(v) || v < 0 || v >= TROOP_SIZE)) {
    fail(`guess must be ${TROOP_SIZE} comma-separated ape ids, each 0-${TROOP_SIZE - 1}`);
  }
  if (new Set(parts).size !== TROOP_SIZE) {
    fail(`guess ids must be a permutation of 0..${TROOP_SIZE - 1} — no repeats, none missing`);
  }
  const ids = parts as ApeId[];

  const dateKey = dateKeyFromPuzzleNumber(n);
  const full = generate(dateKey);
  const feedback = grade(ids, full.solution);
  console.log(JSON.stringify({ feedback, solved: isSolved(feedback) }, null, 2));
} else {
  fail("usage: playtest-cli.ts info <puzzleNumber> | guess <puzzleNumber> <id0,id1,...>");
}
