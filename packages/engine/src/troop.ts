import { randInt, shuffle } from "./rng";

export type ApeId = 0 | 1 | 2 | 3 | 4 | 5;
export type Age = "juvenile" | "subadult" | "prime" | "elder";
export type Build = "slight" | "solid" | "heavy";
export type Silver = "none" | "flecked" | "part-silver" | "full";

/** Bumped from 5 to 6 apes — see DESIGN.md §9.2. Two independent validation
 * passes (optimal-solver simulation, large-scale agent playtest) showed 5
 * apes had hit a hard difficulty ceiling (avg guesses-to-solve maxed ~2.9,
 * never needed 5+ guesses) that binary feedback and raised bands alone
 * couldn't move past. 6 apes (720 permutations vs 120) pushed the ceiling to
 * avg ~3.3, occasional 5-guess puzzles, while staying 100% winnable within 6
 * guesses at every difficulty tested. */
export const TROOP_SIZE = 6;

export interface Ape {
  id: ApeId;
  name: string;
  age: Age;
  build: Build;
  silver: Silver;
  scar: boolean;
}

export const AGES: readonly Age[] = ["juvenile", "subadult", "prime", "elder"];
export const BUILDS: readonly Build[] = ["slight", "solid", "heavy"];
export const SILVERS: readonly Silver[] = ["none", "flecked", "part-silver", "full"];

export const AGE_WEIGHTS: Record<Age, number> = {
  juvenile: 0.0,
  subadult: 1.2,
  prime: 3.0,
  elder: 2.1,
};
export const BUILD_WEIGHTS: Record<Build, number> = {
  slight: 0.0,
  solid: 1.1,
  heavy: 2.1,
};
export const SILVER_WEIGHTS: Record<Silver, number> = {
  none: 0.0,
  flecked: 0.9,
  "part-silver": 1.9,
  full: 3.0,
};
export const SCAR_WEIGHT = 0.4;

/** Trait-favorite wins silverback ~63% of the time at this value (target:
 * 55-65%) — verified empirically for the 6-ape trait distribution, same
 * methodology as the original 5-ape tuning. See DESIGN.md §3. */
export const NOISE = 4.4;

/** Silvering is gated by age — a full-silver juvenile is biologically absurd. */
const SILVER_CAP: Record<Age, Silver> = {
  juvenile: "flecked",
  subadult: "part-silver",
  prime: "full",
  elder: "full",
};

const NAME_POOL: readonly string[] = [
  "Kanzi", "Ndoki", "Bahati", "Ruhondo", "Mgahinga", "Tembo", "Zuri",
  "Kivu", "Nkosi", "Baraka", "Dogora", "Imara", "Jengo", "Kasisi",
  "Lindi", "Mumbi", "Nia", "Okapi", "Pili", "Rafiki", "Sanaa",
  "Taji", "Uzuri", "Virunga", "Wema", "Yasa", "Zawadi", "Chui",
  "Doto", "Enzi", "Fahari", "Gonja", "Heshima", "Ita", "Jua",
  "Kilima", "Luto", "Mvua", "Ngoma", "Panga",
];

type Traits = Pick<Ape, "age" | "build" | "silver" | "scar">;

const MAX_TRAIT_REROLLS = 20;

function drawTraits(rng: () => number): Traits {
  const age = AGES[randInt(rng, AGES.length)];
  const build = BUILDS[randInt(rng, BUILDS.length)];
  const capIndex = SILVERS.indexOf(SILVER_CAP[age]);
  const silver = SILVERS[randInt(rng, capIndex + 1)];
  const scar = rng() < 0.35;
  return { age, build, silver, scar };
}

function traitsMatch(a: Traits, b: Traits): boolean {
  return a.age === b.age && a.build === b.build && a.silver === b.silver && a.scar === b.scar;
}

/**
 * Two apes sharing every visible trait means the "read the room" mechanic
 * gives zero signal for telling them apart — not imperfect, just absent,
 * which is the exact failure mode DESIGN.md §1 warns against ("traits
 * become decoration"). Reroll (deterministically, off the same rng stream)
 * until each ape's trait tuple is distinct from every ape already placed.
 */
export function buildTroop(rng: () => number): Ape[] {
  const names = shuffle(rng, NAME_POOL).slice(0, TROOP_SIZE);
  const apes: Ape[] = [];
  for (let id = 0; id < TROOP_SIZE; id++) {
    let traits = drawTraits(rng);
    let attempts = 0;
    while (apes.some((a) => traitsMatch(a, traits)) && attempts < MAX_TRAIT_REROLLS) {
      traits = drawTraits(rng);
      attempts++;
    }
    apes.push({ id: id as ApeId, name: names[id], ...traits });
  }
  return apes;
}

/** Pure trait sum, no noise — the "visually obvious" score a player could compute by eye. */
export function traitWeight(ape: Ape): number {
  let score = AGE_WEIGHTS[ape.age] + BUILD_WEIGHTS[ape.build] + SILVER_WEIGHTS[ape.silver];
  if (ape.scar) score += SCAR_WEIGHT;
  return score;
}

export function dominanceScore(ape: Ape, rng: () => number): number {
  return traitWeight(ape) + rng() * NOISE;
}

/** Descending sort by dominance score. Returns ape ids, index 0 = silverback. */
export function computeTrueOrder(apes: readonly Ape[], rng: () => number): ApeId[] {
  const scored = apes.map((ape) => ({ id: ape.id, score: dominanceScore(ape, rng) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.id);
}

/** truth[apeId] = the ape's zero-indexed true rank. */
export function truthMap(order: readonly ApeId[]): number[] {
  const truth = new Array(order.length);
  order.forEach((apeId, i) => {
    truth[apeId] = i;
  });
  return truth;
}
