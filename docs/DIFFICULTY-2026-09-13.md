# Silbak — Difficulty Rework Proposal

Date: 2026-09-13 · Author: Claude (Fable 5.1) · Owner: Oz
Engine version measured: `ENGINE_VERSION = 2` (6 apes, binary per-rung feedback, current `BANDS`)

> **How to use this document.** Part 1 measures *why* the game is easy and repetitive, with numbers re-runnable from the appendix. Part 2 measures every candidate lever on the same 730 generated puzzles so they can be compared like for like. Part 3 is the recommendation. Part 4 lists the ideas the numbers ruled out, so they don't get re-proposed without new evidence. It was adopted and shipped as engine v3 on 2026-09-13 (`DESIGN.md` v0.11, all of Part 3), superseding `docs/REVIEW-2026-09-13.md` Phase 3, which it subsumes. Two things were learned in the doing that Part 3 didn't anticipate: the weekend band re-sweep needed a cap on the dominance threshold (`DOMINANCE_CAP` in `select.ts`) before `order`/`half` could appear at all above ceiling 225, and Saturday's band had to sit below 360 because the relational-clue rule makes a floor above an `order` clue's solo strength unreachable. The playtest gate result is recorded in `DESIGN.md` §9.6.

---

## Part 1 — Why it is easy (diagnosis)

### 1.1 The feedback channel is a firehose

Six rungs of binary feedback carry up to 6 bits per guess. Measured on the first guess of a real puzzle (the most trait-plausible arrangement consistent with the notes), binary feedback yields **4.1 bits** on average and splits the surviving space into **38 distinct outcomes**. The whole puzzle only needs **7.1 bits** (average `log2(space)`). Two guesses are structurally enough almost every day, and no amount of clue-band tuning changes that: the bands move a trait-driven player from 1.8 (Mon) to 2.4 (Sat) guesses, a spread of 0.6.

| Feedback on guess 1 | Distinct outcomes | Bits | Largest bucket |
|---|---|---|---|
| binary per rung (current) | 38.2 | 4.06 | 27% |
| count only ("N right") | 5.9 | 2.10 | 35% |
| "challenges" (Kendall inversions) | 12.3 | 3.21 | 17% |

### 1.2 The trait order is nearly the answer

Over 730 days the pure trait sort (no notes, no guesses) is on average **2.6 adjacent swaps** from the truth (max possible 15). The distribution:

| Swaps from truth | 0 | 1 | 2 | 3 | 4 | 5 | 6+ |
|---|---|---|---|---|---|---|---|
| share of days | 6% | 20% | 25% | 23% | 13% | 7% | 5% |

The trait sort alone gets ≥3 rungs exactly right on 48% of days and every ape within one rung of its true rank on 39% of days. Trait favorite is silverback 65% of the time (on target per §3 of DESIGN.md), trait-least is omega 59%. The 55–65% target governs rung 1 only; nothing constrains how close the *rest* of the order is, and it is close.

### 1.3 The notes narrow to "which of the top few"

Ranking each day's clue-survivors by trait plausibility and asking where the true order sits:

| Day | avg space | truth's rank (median) | truth in top 3 | in top 10 |
|---|---|---|---|---|
| Mon | 32 | 3 | 60% | 91% |
| Tue | 115 | 6 | 38% | 60% |
| Wed | 177 | 7 | 30% | 65% |
| Thu | 204 | 8 | 33% | 56% |
| Fri | 330 | 9 | 29% | 51% |
| Sat | 490 | 11 | 23% | 49% |
| Sun | 50 | 4 | 50% | 80% |

Even on Saturday, with 490 permutations "surviving", the truth is one of the ten most trait-plausible half the time. The reported `space` overstates the search a human faces by an order of magnitude.

### 1.4 A modest player solves in two

Two solvers on the 730 real puzzles, binary feedback:

- **trait-greedy** — a model of an attentive human: always submit the most trait-plausible arrangement still consistent with the notes and all feedback; no probing, no lookahead.
- **minimax** — Knuth-style worst-case-bucket minimiser over the consistent set (an upper bound on play quality).

| | avg | median | max | needs 4+ | losses at cap 6 / 5 / 4 |
|---|---|---|---|---|---|
| trait-greedy | **2.10** | 2 | 4 | 2% | 0% / 0% / 0% |
| minimax | 2.32 | 2 | 4 | 2% | 0% / 0% / 0% |

Per weekday, trait-greedy: Mon 1.85 · Tue 2.12 · Wed 2.09 · Thu 2.11 · Fri 2.25 · Sat 2.36 · Sun 1.96. The 6-guess limit is never in play. Blind agent playtests (avg 2.17–2.27, max 4, 0 losses, see the review) match this model closely.

### 1.5 "Narrow and repetitive" is real and measurable

- **51%** of puzzles have exactly two notes.
- **29%** of puzzles (every Fri and Sat) are `neg`-only — "X is not the silverback" stacked, no relative-order information at all.
- Distinct clue-kind signatures per weekday: Mon 25 · Sun 14 · Tue 9 · Wed 6 · Thu 4 · **Fri 1 · Sat 1**. Thursday is one signature (`neg,order`) 62% of the time.
- Named clues only come in four strengths — a single clue always leaves exactly 120, 240, 360 or 600 of 720 — which is why the bands land on a lattice rather than a continuum (already documented in `select.ts`).

---

## Part 2 — Levers, measured on the same puzzles

All rows: same 730 puzzles (2026-01-01 onward), both solvers, 14-guess cap so the true distribution is visible. "Spread" is trait-greedy Mon → Sat.

### 2.1 Feedback semantics (the difficulty lever)

| Feedback | greedy avg | greedy max | greedy loss @6 / @5 / @4 | minimax avg | spread Mon→Sat |
|---|---|---|---|---|---|
| binary per rung (current) | 2.10 | 4 | 0 / 0 / 0% | 2.32 | 1.8 → 2.4 |
| **count only** — "N apes on their true rung" | **2.87** | 6 | 0 / 0.8 / 8.2% | **3.35** | **2.3 → 3.4** |
| Kendall — "N challenges to settle your order" | 2.97 | 6 | 0 / 1.9 / 11.5% | 3.09 | 2.3 → 3.6 |
| adjacent pairs — "is each neighbour pair in the right order" (5 glyphs) | 2.38 | 6 | 0 / 0.1 / 1.8% | 2.80 | 2.0 → 2.6 |
| exact count + one-off count (Mastermind black/white) | 2.46 | 5 | 0 / 0 / 0.1% | 2.58 | 2.1 → 2.8 |
| ends binary (silverback, omega) + middle count | 2.42 | 6 | 0 / 0.3 / 1.1% | 2.72 | 2.0 → 2.8 |
| count + Kendall together | 2.48 | 4 | 0 / 0 / 0% | 2.45 | 2.1 → 2.8 |

Count-only per weekday (trait-greedy, perfect note-keeping):

| Day | avg | median | needs 4+ | needs 5+ | loss @6 | loss @5 |
|---|---|---|---|---|---|---|
| Mon | 2.31 | 2 | 13% | 1% | 0% | 0% |
| Tue | 2.73 | 3 | 24% | 5% | 0% | 0% |
| Wed | 2.86 | 3 | 29% | 3% | 0% | 0% |
| Thu | 2.91 | 3 | 37% | 8% | 0% | 1.0% |
| Fri | 3.29 | 3 | 45% | 19% | 0% | 1.0% |
| Sat | 3.36 | 3 | 42% | 17% | 0% | 2.9% |
| Sun | 2.63 | 3 | 20% | 5% | 0% | 1.0% |

Two further facts about count-only:

- **It makes the theme more load-bearing, not less.** A player who ignores traits (random consistent guess) averages 2.89 under binary feedback but **4.32 under count-only, with 2.6% losses at six guesses**. Reading the traits is worth 0.8 guesses today and 1.45 guesses under count-only. This directly strengthens the "theme carries signal" pillar.
- **Probe guesses don't help.** Letting minimax guess any of the 720 permutations (not just consistent ones) changes the average by +0.03 (binary) and −0.10 (count-only). So "hard mode" (guesses must be consistent) is not a difficulty lever in either scheme; see Part 4.

### 2.2 Clue pool (the variety lever)

Prototyped a family of **trait-quantified clues** — statements about trait classes rather than named apes — and fed them to the real `selectClues` alongside the existing named clues, with today's bands:

| Kind | Example | Notes |
|---|---|---|
| `t-order` | "Every elder outranks every subadult." | class vs class |
| `t-zone` | "No scarred ape ranks in the top two." | class excluded from a zone |
| `t-rung` | "The omega is a juvenile." / "The silverback is not full-silver." | named rung, class of ape |
| `t-adj` | "The two heavy apes hold neighbouring rungs." / "…are not neighbours." | for classes of exactly 2 (3: "consecutive rungs") |
| `t-count` | "Exactly one of the three flecked apes ranks in the top three." | class count in a zone |
| `t-pair` | "A prime stands directly above a juvenile." | existential adjacency |

Measured:

- **82.6 true trait-clues per troop** on top of the 62 named ones. Their solo strength is a continuum (solo survivors: 1–120: 9%, 121–240: 34%, 241–360: 27%, 361–480: 25%, 481+: 6%) rather than the four fixed lattice values, which is what the bands need.
- Distinct kind-signatures per weekday go from **Mon 25 / Tue 9 / Wed 6 / Thu 4 / Fri 1 / Sat 1 / Sun 14** to **Mon 77 / Tue 63 / Wed 61 / Thu 54 / Fri 3 / Sat 6 / Sun 62**. Distinct `space` values on Thursday go from 4 to 15. Friday stays stuck because its band floor (240) plus `DOMINANCE_MARGIN` still admit almost nothing but `neg`; it needs the band re-sweep the review already prescribes.
- Solver difficulty at equal `space` is unchanged (trait-greedy 2.10 either way). The human cost is the **decode step** — "which apes are the elders, and does *every* one of them clear *every* subadult?" — which is exactly the kind of reasoning the current notes never ask for.

### 2.3 Everything else

| Lever | Result | Verdict |
|---|---|---|
| Seven apes (5,040 perms), binary feedback | greedy 2.0–2.6 even at space ≈ 3,000; max 4; 0% losses | **No.** Binary feedback scales with rung count; the extra ape adds a bit of feedback for every bit of answer space. UI cost is high (mobile is already 1.7 screens). |
| Seven apes + count-only | greedy 3.6–4.2 at space ≥ 500, 5% losses | Only interesting *after* a feedback change, and then unnecessary. |
| "One of the notes is false" | space ×3.9, but greedy 2.10 → 2.35 (binary), 3.38 (count-only) | **No as a difficulty lever.** Binary feedback absorbs the ambiguity; the human cost is confusion, not deduction. Possible rare flavour twist later. |
| Observe-or-submit (spend a day to get another true note) | "Never observe" dominates every policy under both feedback schemes (2.10 vs ≥2.94; 2.87 vs ≥3.49) | **No.** A random true note is never worth a guess. Would need player-chosen notes and much weaker feedback to become a real decision. |
| Hard mode (guesses must be consistent) | probe advantage 0.03 guesses | **No effect** on difficulty for a logical player; only removes throwaway guesses nobody needs. |
| Guess cap 4 or 5 | 0% solver losses at 4 today; humans in playtests needed 4 on 13% of puzzles | A dial, not a fix — harder by punishment, and it does nothing about "narrow and repetitive". Keep 6. |

---

## Part 3 — Recommendation

Three changes, in this order. Each is independently shippable; the first is the one that matters.

### 3.1 Feedback: the troop tells you *how many*, not *which*

Replace per-rung `exact`/`wrong` with a single count per guess: **"4 of 6 hold their true rung."** No positions, no direction.

Why this one:
- It is the only lever that moves the average past 3 for an optimal solver and produces a genuine weekly curve (2.3 → 3.4 for a careful human; real humans will sit between that and the trait-ignoring 4.3). Losses at six guesses become possible but rare, concentrated on Fri/Sat — a Wordle-shaped distribution instead of a game nobody loses.
- It is the Mastermind / Bulls-and-Cows convention, which the casual audience already knows. Learnable in one turn ("3 of 6" needs no legend).
- It keeps everything else: 6 apes, 6 guesses, the notes, the traits, the ladder, tap-to-swap. Only `grade.ts` and the surfaces that render feedback change.
- The share grid gets *safer*: today's grid reveals which rungs a friend had right; a count row (`🍌🍌🍌🍌🪨🪨`) reveals only the number. The banana/rock language and the reserved `--banana` token survive intact.
- It makes traits worth 1.45 guesses instead of 0.8, so "read the room" becomes a bigger part of the game, not a smaller one.

Concretely:
- `grade()` returns `{ exact: number }` (or a `FeedbackSignal[]` of `n` bananas then rocks, which keeps `shareGrid` unchanged — pick one; the count is the semantic).
- Board: replace the per-rung glyph column with one badge per guess ("4 / 6 held") on the ladder and in the history rows. Phase 1's per-rung feedback persistence becomes moot; the history rows (arrangement + count) become the primary deduction surface.
- Add a deduction aid, because elimination is now inferential: an ape × rung grid the player can mark (✗ / ✓) by tapping — the equivalent of Wordle's coloured keyboard. Without it the game "demands a notepad", the exact complaint the review recorded for guess 3+.
- Rules copy: "After each guess the troop tells you how many apes stand on their true rung — not which ones."
- Keep the cap at 6. A perfect note-keeper never loses at 6 and loses 1–3% at 5 on Fri/Sat; humans will lose a few percent at 6, which is the point.
- Keep the current bands to start. They already yield the curve above under count-only; re-sweep them together with 3.2.

Risk, and the gate: count-only can tip from "too easy" to "frustrating" if the deduction aid is weak, because a human cannot do set-intersection in their head. **Gate it on a blind playtest** (`.claude/skills/playtest-puzzles/SKILL.md`, 75 puzzles, fresh numbers ≥ #600) before promoting. Success looks like: avg 3.0–3.5, ≥30% of puzzles needing 4+, losses under ~5% and concentrated on Fri/Sat, and the qualitative notes saying "tricky" rather than "unfair". If it fails the gate, the measured fallbacks are adjacent-pair "deference" feedback (2.38 / 2.80, thematic, keeps a per-position glyph — drawn *between* rungs) or ends-binary + middle count (2.42 / 2.72, keeps the "I found the silverback" moment).

`ENGINE_VERSION` → 3. Regenerate the determinism snapshot deliberately. `difficulty-simulation.test.ts` already defines `gradeBinary` locally as a historical baseline; add `gradeCount` beside it the same way and keep the paired comparison.

### 3.2 Notes: quantify over traits, and require relative-order information

Add the trait-quantified clue family from §2.2 to `candidateClues`, and fix the weekend the way the review's Phase 3 prescribes (at least one relational clue in every set; re-sweep Fri/Sat bands; reword `between` and the extreme `count` clues).

Rules for the new kinds, learned while prototyping:
- **Never emit a class of size 1 as a class clue** ("every heavy ape outranks every subadult ape" with one heavy and one subadult is a named `order` clue in disguise). Size 2–4 only; the whole troop never.
- **Never pair overlapping classes** (a heavy scarred ape belongs to both "heavy" and "scarred"). The prototype already excludes this.
- Phrasing needs a small formatter: "every ape with no silver", "both juveniles", "neither scarred ape", "the three heavy apes". Same rule as today — clarity beats flavour whenever flavour could change the parse.
- Weight the pool so a trait clue appears on most days but rarely fills the whole set; the greedy selector already does this naturally (76–97% of weekdays used one in the prototype).
- Add the diversity invariant the review asks for (≥4 distinct spaces and ≥4 kind-signatures per weekday over ≥100 days, at least one relational clue per puzzle). It would have caught Friday and Saturday.
- Update the `About` page with one example per new kind.

This is the change that answers "narrow and repetitive". It does not change difficulty at equal `space` for a solver, and that is fine: 3.1 owns difficulty, 3.2 owns variety, and the attribution stays clean.

### 3.3 Scoring: par, not just a count

With a real weekly curve the guess count finally means something different on Monday and Saturday, so let the score say so.

- **Par per weekday**, set from the playtest median once 3.1 lands (starting hypothesis from the count-only table: Mon 2, Tue–Thu 3, Fri–Sat 4, Sun 3; humans will push these up by ~1). Share line becomes `Silbak #256  3/6 · par 3` and the result card shows "on par" / "one under". A cumulative "vs par this month" number in the stats panel gives regulars something to chase that a streak can't: playing well on hard days.
- **Clean read marker** for a solve in one (`🥇` on the share line). A perfect trait reader hits it on ~14% of days; humans far less. It is the rarity badge the game currently lacks.
- Guess cap stays 6; streak semantics (v0.10) untouched.
- Do *not* add time or point-per-rung scoring — both fight the 90-seconds-once product thesis.

### Suggested order and cost

| Step | Scope | Effort | Depends on |
|---|---|---|---|
| 3.1 feedback + deduction grid + playtest gate | engine `grade.ts`, web board/history/rules/share, DESIGN §2 §5 | 1–2 days + playtest | — |
| 3.2 trait clues + weekend fix + diversity test | engine `clues.ts` `select.ts` bands, tests, DESIGN §4, About page | 1–2 days incl. sweep | 3.1 (sweep bands under the new feedback) |
| 3.3 par + share + stats | web only, DESIGN §5 | half a day | 3.1 playtest medians |

One engine version bump (2 → 3) if 3.1 and 3.2 ship together; two if not. Pre-launch either is fine.

---

## Part 4 — Ideas the numbers ruled out

Recorded so they aren't re-proposed without new evidence.

- **More apes.** Binary feedback grows with rung count, so 7 apes buys ~0.3 guesses at a large UI cost. Under count-only it would buy more, but count-only alone already reaches the target.
- **Fewer guesses.** Makes losses without making puzzles. Solver loss rate is 0% at a cap of 4; humans would lose ~13% at a cap of 3. Not the lever.
- **Unreliable observer / one false note.** ×3.9 space for +0.25 guesses. Confusing rather than hard; keep for a possible rare themed twist.
- **Observe-or-submit.** Never observing dominates. Not a decision.
- **Hard mode.** Probing is worth 0.03 guesses. Nothing to take away.
- **Directional feedback** (already reversed in v0.2) — the numbers here confirm the direction of that reversal; the per-rung binary that replaced it is still 4 bits a guess.
- **Hiding traits until guess two** (DESIGN §9.3). Traits are worth 0.8 guesses today; hiding them for one turn is worth less than that and breaks "learnable in one turn". Under count-only the traits are worth more, so hiding them would matter more — and hurt more.

Worth prototyping later, not now: **"challenges" feedback** (Kendall inversions — "it would take 4 challenges to settle your order"; each challenge is one neighbouring pair swapping, which is literally how a dominance hierarchy settles). It measured as hard as count-only with a smoother worst case, and it is the most thematically honest signal in the table. It lost to count-only on teachability only. A "field mode" toggle behind the same `grade()` seam would let it be tried without a version bump.

---

## Appendix — method and reproduction

Everything above was measured with a disposable harness that imports the real engine (`generate`, `candidateClues`, `selectClues`, `traitWeight`, `truthMap`) over 730 consecutive dates from 2026-01-01, so every weekday band appears ~104 times. Definitions, so the numbers can be reproduced or the harness rebuilt in `packages/engine/test/` if wanted:

- **Trait cost** of an arrangement: sum over every pair placed against the trait gradient of the trait-weight gap between them (ties cost nothing). "Most trait-plausible" = minimum trait cost.
- **trait-greedy solver:** remaining = permutations consistent with the notes; guess = min-trait-cost member of remaining; filter remaining by the guess's feedback; repeat. No lookahead.
- **minimax solver:** guess = member of remaining (sampled to ≤100–200 when large) whose worst-case feedback bucket over remaining is smallest, ties toward lower trait cost. The "free-probe" variant draws guesses from all 720.
- **Feedback variants:** binary = per-rung exact flag; count = number of exact rungs; Kendall = number of pairs in inverted relative order; exact+near = exact count and count of apes one rung off; ends+count = exact flags for rungs 1 and 6 plus exact count for rungs 2–5; pairs = for each of the 5 neighbouring pairs in the guess, whether the upper ape truly outranks the lower.
- **Seven apes:** generic copies of `buildTroop` and `candidateClues` parameterised on N, same trait weights and `NOISE`, run through the real `selectClues` with degenerate target bands; 40 trials per band.
- **Unreliable note:** survivors = permutations satisfying at least k−1 of the k notes.
- **Observe-or-submit:** an "observe" day draws the next unseen true note (any kind except `count`) that still narrows the remaining set; a "submit" day plays trait-greedy. 6-day budget.
- **Trait-quantified clues:** generated from trait classes (age, build, silver, scar) of size 1–4 as in §2.2; solo strength = survivors among all 720.

Runtime for the whole set is under three minutes on a laptop; the seven-ape and free-probe runs dominate.
