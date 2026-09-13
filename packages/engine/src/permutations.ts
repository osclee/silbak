import { TROOP_SIZE } from "./troop";

/** All TROOP_SIZE! permutations of [0..TROOP_SIZE-1] — the answer space. */
export function allPermutations(): number[][] {
  const ids = Array.from({ length: TROOP_SIZE }, (_, i) => i);
  const result: number[][] = [];
  function permute(remaining: number[], acc: number[]) {
    if (remaining.length === 0) {
      result.push(acc);
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      const next = remaining.slice();
      const [picked] = next.splice(i, 1);
      permute(next, acc.concat(picked));
    }
  }
  permute(ids, []);
  return result;
}
