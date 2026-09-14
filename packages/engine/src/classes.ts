import type { Age, Ape, ApeId, Build, Silver } from "./troop";
import { AGES, BUILDS, SILVERS, TROOP_SIZE } from "./troop";

/**
 * A set of apes sharing one visible trait value — the thing a trait-quantified
 * clue talks about. Carries every phrasing a clue needs so the words are
 * decided in one place and always match the rung labels the player reads
 * them against (DESIGN.md §4: clarity beats flavour whenever flavour could
 * change the parse).
 */
export interface TraitClass {
  members: readonly ApeId[];
  size: number;
  /** "elder", "heavy ape", "ape with no silver" — after "every" / "no". */
  singular: string;
  /** "an elder", "a heavy ape" — as a subject or object. */
  article: string;
  /** "elders", "heavy apes" — after "the two" / "of the three". */
  plural: string;
  /** "is an elder", "has no silver" — predicate on a named rung. */
  is: string;
  /** "is not an elder", "has some silver". */
  isNot: string;
}

const MIN_CLASS = 2;
const MAX_CLASS = 4;

interface Wording {
  singular: string;
  article: string;
  plural: string;
  is: string;
  isNot: string;
}

function noun(singular: string, article: "a" | "an", plural = `${singular}s`): Wording {
  return {
    singular,
    article: `${article} ${singular}`,
    plural,
    is: `is ${article} ${singular}`,
    isNot: `is not ${article} ${singular}`,
  };
}

const AGE_WORDS: Record<Age, Wording> = {
  juvenile: noun("juvenile", "a"),
  subadult: noun("subadult", "a"),
  prime: noun("prime", "a"),
  elder: noun("elder", "an"),
};

// Build and silver read as adjectives on the rung ("heavy", "part-silver"),
// so the predicate forms use the bare adjective rather than "is a heavy ape".
const BUILD_WORDS: Record<Build, Wording> = {
  slight: { ...noun("slight ape", "a"), is: "is slight", isNot: "is not slight" },
  solid: { ...noun("solid ape", "a"), is: "is solid", isNot: "is not solid" },
  heavy: { ...noun("heavy ape", "a"), is: "is heavy", isNot: "is not heavy" },
};

const SILVER_WORDS: Record<Silver, Wording> = {
  none: {
    singular: "ape with no silver",
    article: "an ape with no silver",
    plural: "apes with no silver",
    is: "has no silver",
    isNot: "has some silver",
  },
  flecked: { ...noun("flecked ape", "a"), is: "is flecked", isNot: "is not flecked" },
  "part-silver": { ...noun("part-silver ape", "a"), is: "is part-silver", isNot: "is not part-silver" },
  full: { ...noun("full-silver ape", "a"), is: "is full-silver", isNot: "is not full-silver" },
};

const SCAR_WORDS: Record<"scarred" | "unscarred", Wording> = {
  scarred: { ...noun("scarred ape", "a"), is: "is scarred", isNot: "is not scarred" },
  unscarred: { ...noun("unscarred ape", "an"), is: "is unscarred", isNot: "is scarred" },
};

/**
 * Every trait class of 2–4 apes in the troop. Size 1 is excluded because a
 * class clue about one ape is a named clue in disguise; the whole troop is
 * excluded because "every ape" says nothing. Order is fixed by trait then
 * value so generation stays deterministic.
 */
export function traitClasses(apes: readonly Ape[]): TraitClass[] {
  const out: TraitClass[] = [];
  const push = (members: ApeId[], w: Wording) => {
    if (members.length < MIN_CLASS || members.length > MAX_CLASS || members.length >= TROOP_SIZE) return;
    out.push({ members, size: members.length, ...w });
  };

  for (const age of AGES) {
    push(apes.filter((a) => a.age === age).map((a) => a.id), AGE_WORDS[age]);
  }
  for (const build of BUILDS) {
    push(apes.filter((a) => a.build === build).map((a) => a.id), BUILD_WORDS[build]);
  }
  for (const silver of SILVERS) {
    push(apes.filter((a) => a.silver === silver).map((a) => a.id), SILVER_WORDS[silver]);
  }
  push(apes.filter((a) => a.scar).map((a) => a.id), SCAR_WORDS.scarred);
  push(apes.filter((a) => !a.scar).map((a) => a.id), SCAR_WORDS.unscarred);

  return out;
}
