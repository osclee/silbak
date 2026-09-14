# Silbak — Design Specification

> A daily deduction game. Rank six apes in a gorilla troop from silverback to omega in six guesses.

Status: draft v0.11 · Owner: Oz · Last updated: 2026-09-13

> **v0.11 changelog:** the difficulty rework (`docs/DIFFICULTY-2026-09-13.md`, all three parts shipped together as engine v3). (1) **Feedback is a count, not a map**: after a guess the troop says how many apes stand on their true rung — never which. Per-rung binary feedback was measured at ~4 bits a guess against a ~7-bit puzzle, which made nearly every day a two-guess game no matter what the clues did; a count is the only feedback rule measured to move a careful solver past three guesses and produce a real Monday→Saturday curve. The board gained a player-kept ape × rung **ledger** (✗/✓) because elimination is now inferential. (2) **Trait-quantified clues** ("every elder outranks every subadult") join the named ones, `between` and the extreme `count` clues were reworded, every clue set must carry a relational clue, and the weekend bands were rebuilt with a cap on the dominance threshold — Friday went from one clue-kind signature to 26. (3) **Par**: each weekday carries an expected guess count; the share line reads `3/6 · par 3`, a one-guess solve earns 🥇, and the result card shows "vs par this month". See §2, §4, §5, §7 and §9.6.
>
> **v0.10 changelog:** persistence and the archive were both wrong in ways that only showed up a day later (`docs/REVIEW-2026-09-13.md` Phase 2). `submit()` now writes `streak`/`played` itself at the terminal guess instead of waiting for the next day's `load()` to roll it over — the old path meant a win never updated the streak until tomorrow, and merely opening the app on a day you didn't play recorded a loss, since `load()` used to persist a placeholder `current` on first open. `load()` no longer does that; `applyRollover` is now a safety net (a day with no guesses leaves no trace; a day whose terminal submit already recorded itself is a no-op, so nothing double-counts). An open tab left running past local midnight now notices via `visibilitychange`/`focus`/a 60s check, instead of only rolling over on the next full page load. The archive no longer leaks today or future dates (`/archive/<n>` redirects home or to `/archive` outside `[1, today)`) and gained a top-level error boundary instead of a white screen on a malformed URL; its list now shows each day's date/weekday and a 🍌/🪨 result marker instead of a bare puzzle number and a "Silbak epoch" line. See §9.5.
>
> **v0.9 changelog:** the board now supports deduction instead of fighting it (`docs/REVIEW-2026-09-13.md` Phase 1). Three changes, shipped together because testers hit all three in the same sitting: (1) feedback on a rung now persists until that rung's occupant changes, instead of the whole board's glyphs vanishing on any swap; (2) the attempts history renders each past arrangement (short name + glyph per rung), not just its feedback, since binary feedback is a position-elimination game and elimination is impossible without seeing what was where; (3) resubmitting an arrangement identical to the last graded one is now blocked, both at the button and in the store, since it can't teach the player anything. See §2 and §7.
>
> **v0.8 changelog:** picking up a rung and swapping two of them are now visible events. Selection recolours the whole rung — `--moss` surface, `--rock` ring, a 10px nudge — instead of tinting a 1px border `--banana`, which was both easy to miss and a borrow of the one reserved token (§6). A swap animates: the two rungs fly to each other's slots in 260ms, the rising one passing in front with a lift shadow. See §6 (Tokens, and the selected-rung note) and Motion.
>
> **v0.7 changelog:** a new `--card` token (`#2A7744`) gives every panel — result card, field notes, archive list, and the Rung itself — a softer, lighter green than `--bark`. `--card` is a blend toward `--mist` chosen to clear >=3:1 contrast against `--banana` (large text/UI components) and >=4.5:1 against `--paper`/`--mist` body text, so it reads lighter without repeating the pastel-panel mistake the v0.4 reversion already documented. Putting `--card` under the Rung meant the "correct rung" glyph (`.exact`, `--banana` on the panel) no longer clears 4.5:1 at its old regular weight/1.1rem size, so it went to 700/1.2rem to qualify as large text at the 3:1 threshold instead — see §6, "Why the panel green didn't go all the way to pastel". `--bark` itself is unchanged and still used where a panel isn't a "card" (attempt-history chips, `/dev/apes`).
>
> **v0.6 changelog:** the ape portraits were redrawn as a layered retro-vector cel in natural gorilla colors. They no longer borrow the page's green tokens by value; they own a five-token fur/skin/silver palette of their own, which retires the constraint that once pinned `--bark` to the portrait (see §6, "Why the panel green didn't go all the way to pastel"). Shading is flat shadow and highlight masses clipped inside each part, the silhouette is inked by a fattened underlay rather than per-part contours, and two trait tells were added (a shoulder hump for build, greying for elders). A dev-only `/dev/apes` route renders the whole valid trait matrix at 56px and 46px for eyeballing. See §6, Portraits.
>
> **v0.5 changelog:** the canopy backdrop was rebuilt from a tiled SVG `<pattern>` into a stack of height-agnostic layers (full-height trunks, edge-anchored canopy/understory bands, percentage-placed boughs and motes). Three measured defects forced it: nothing inside `<defs>` ever animated, so the documented canopy sway had never once rendered; the tile's `ResizeObserver` height never landed, seaming the page mid-scroll; and a single repeated tile cannot produce a forest. The palette is untouched — depth now comes from `color-mix()` blends of existing tokens. See §6 for the architecture and the traps.
>
> **v0.4 changelog:** visual system flipped from a dark, muted "field station at night" palette to a bright, saturated "jungle in daylight" one — lighter and more playful, closer to Donkey Kong Country's box art than a research log. Page ground moved from near-black to a warm banana-cream; the primary green went from almost-black to a real, vivid jungle green; wood-tone and red accents were leaned into harder. See §6 for the new token table and the reasoning behind which roles could and couldn't just get lighter.
>
> **v0.3 changelog:** troop size raised from 5 apes (120 permutations) to 6 (720). This resolves open question §9.2, which was left open in v0.2 pending prototyping. A parallel prototype engine was built, simulated, and playtested (75 agent-played puzzles) before promotion — see §4 for the numbers and §9.2 for the resolution writeup. `ENGINE_VERSION` bumped 1→2 (every puzzle changed; fine pre-launch, no live players depend on v1 continuity).
>
> **v0.2 changelog:** feedback signal changed from directional (`exact`/`up`/`down`) to binary (`exact`/`wrong`), and weekday difficulty bands were raised substantially. Both changes are the direct result of simulation work recorded in `packages/engine/test/difficulty-simulation.test.ts` — see §2 and §4 for the numbers. The original v0.1 rationale for directional feedback is kept below (§2) as a documented reversal, not deleted, since the "why" of a design U-turn is worth more than the U-turn itself.

---

## 1. Product thesis

Silbak occupies the same slot in a person's day as Wordle: **90 seconds, once, same puzzle for everyone, one shareable line of emoji.** It differs from the word-game field in three ways that matter:

1. **The answer space is a permutation, not a vocabulary.** No language knowledge required, so it travels internationally without localization of the puzzle itself.
2. **The theme is the information channel.** Traits (age, build, silvering) genuinely predict rank. The gorilla framing isn't a skin — remove it and the puzzle loses its opening move.
3. **The puzzle is deliberately under-determined.** Clues narrow the space but never to one answer. Deduction gets you close; the guess grid gets you the rest of the way. This is what produces a share grid with a *shape*.

### Design pillars

| Pillar | Means | Fails when |
|---|---|---|
| Learnable in one turn | First submission teaches the feedback language | We add a tutorial modal |
| Deduction with tension | Clues leave a real range of valid orders (see §4 — raised from the original 3–22 target) | Clues fully determine the answer |
| Theme carries signal | Traits correlate with rank, imperfectly | Traits become decoration |
| Spoiler-free share | Grid shows path, never content | We include arrows or names in share text |
| No account required | Device-local play, optional sync later | Login gates the daily puzzle |

### Non-goals for v1

Multiplayer, real-time play, unlimited/endless mode, accounts, leaderboards, monetization, native apps.

---

## 2. Game rules (canonical)

**Board.** Six apes arranged in a vertical ladder. Position 1 (top) is the **silverback**; position 6 (bottom) is the **omega**. Positions 2–5 are unlabeled.

**Interaction.** Tap an ape to select it; tap a second to swap them. Tap the same ape to deselect. Drag is not required — tap-to-swap is the primary input and must work on touch and keyboard.

**Turn.** Submit the current arrangement. The troop answers with one number: **how many apes stand on their true rung** — "4 of 6". Nothing about which ones, nothing about direction. This is the Mastermind / Bulls-and-Cows convention, and it needs no legend.

The count belongs to the arrangement it graded. The board shows it beneath the ladder while that arrangement is still on the ladder, and steps it back (muted, "board changed since") the moment the player swaps anything; the attempts history keeps every arrangement with its count as the permanent record.

**The ledger.** Because a count says nothing about *which* rungs were right, elimination is inferential — "guess 2 scored 3, guess 3 moved only Kanzi and scored 2, so Kanzi *was* right at rung 3". The board carries an ape × rung grid the player marks by tapping (blank → ✗ ruled out → ✓ confirmed → blank). It is the equivalent of Wordle's coloured keyboard: a place to write down what has been inferred, not a solver. Nothing in it is checked against the solution, with one deliberate exception — a guess that scores 0 rules out every ape on it, and that is mechanical enough that the ledger fills it in. Without the ledger the game "demands a notepad", which was the exact complaint testers recorded for guess 3+ under the old per-rung scheme.

**Limit.** Six guesses. Win on 6 of 6. Loss reveals the true order.

**Field notes.** Observations shown before the first guess, always true of the solution, never sufficient to determine it alone. Count varies more than in v0.1 (2–4 was the old range) since looser bands (§4) need more clues to narrow into.

### Feedback semantics — the precise rule

Let `truth[apeId]` be the ape's zero-indexed true position. For a guess `g`:

```
exact = |{ i : truth[g[i]] === i }|
```

The guess is solved when `exact === 6`.

### Why this changed from per-rung binary to a count (v0.11)

Binary feedback (below) fixed the directional problem and then hit the same wall one level up. Measured on 730 generated puzzles (`docs/DIFFICULTY-2026-09-13.md` Part 1): six rungs of binary feedback carry **4.1 bits** on a real first guess and split the surviving space into 38 distinct outcomes, while the whole puzzle only needs **7.1 bits**. Two guesses were structurally enough almost every day, and no clue-band tuning could change that — the bands moved a trait-reading player from 1.8 (Mon) to 2.4 (Sat) guesses, a spread of 0.6. Blind playtests matched: avg 2.17–2.27, max 4, zero losses.

Every candidate lever was measured on the same puzzles with the same two solvers (a trait-greedy "attentive human" and a minimax upper bound). Feedback semantics was the only lever that moved the average past three:

| Feedback | greedy avg | minimax avg | Mon → Sat |
|---|---|---|---|
| binary per rung (v0.2–v0.10) | 2.10 | 2.32 | 1.8 → 2.4 |
| **count only (v0.11)** | **2.87** | **3.35** | **2.3 → 3.4** |
| Kendall "challenges" | 2.97 | 3.09 | 2.3 → 3.6 |
| adjacent-pair deference | 2.38 | 2.80 | 2.0 → 2.6 |

Count-only won on teachability. Two side effects are worth keeping in view: it makes the traits *more* load-bearing (a trait-ignoring player averages 4.3 under count feedback vs 2.9 under binary, so "read the room" is worth 1.45 guesses instead of 0.8), and it makes losses at six possible but rare — a Wordle-shaped distribution instead of a game nobody loses. The share grid also got safer: a count row reveals only *how many*, where a per-rung row revealed *which*.

The Kendall variant ("it would take 4 challenges to settle your order") is the most thematically honest signal in the table and lost only on teachability; `grade()` returns an object rather than a bare number so a second signal can ride alongside if it's ever tried.

### Why this changed from directional to binary feedback (v0.2)

The original v0.1 rule was directional (`up`/`down`, telling the player which way to move a wrong ape), with this stated rationale: *"up/down are strictly more generous than Mastermind's black/white pegs — a deliberate choice, since permutation puzzles without directional feedback are punishing on a 5-element space with only six guesses."*

That fear turned out to be unfounded, and the generosity was actively working against the game. Simulation (`difficulty-simulation.test.ts`) ran a Knuth-style optimal adaptive solver against real generated puzzles at every achievable space size (2 through the clue engine's structural ceiling of ~78) and found:

- With directional feedback, average guesses-to-solve barely moved across the **entire** achievable range: 1.48 (space=2) → 2.38 (space=78). A single directional guess resolves permutation ambiguity almost immediately regardless of how much the clues left unresolved — the clue phase's difficulty was structurally disconnected from how many guesses the game actually took.
- Switching to binary feedback, on identical puzzles (same seeds, paired comparison), raised the average by +0.0 to +0.5 guesses depending on space size — a real, monotonically-growing effect, and the *first* variant in either sweep to ever produce a 4-guess optimal-play trial.
- Critically, **zero trials in either scheme, at any space size tested, ever needed more than 4 of the 6 allowed guesses.** So the fear the original rule was hedging against (punishing 5-element permutation guessing) does not materialize even at the loosest, most information-poor configuration tested.

Binary feedback alone is a modest lever; it's meant to be paired with raised bands (§4) — the two are complementary, not substitutes. A caveat worth keeping in view: the simulator measures *optimal* play, not how an average human actually experiences the puzzle. A follow-up manual playtest (see project history / `packages/engine/scripts` if a CLI harness exists) is the intended way to validate this against something closer to real difficulty, not just winnability.

---

## 3. The dominance model

Each ape carries four visible traits. Three are scored; one is flavor with a small weight.

| Trait | Values | Weight |
|---|---|---|
| Age | juvenile 0.0 · subadult 1.2 · **prime 3.0** · elder 2.1 | primary |
| Build | slight 0.0 · solid 1.1 · heavy 2.1 | secondary |
| Silvering | none 0.0 · flecked 0.9 · part-silver 1.9 · full 3.0 | primary |
| Scarred | +0.4 if present | flavor |

**Dominance score** = sum of weights + `random() * NOISE`.

True rank = descending sort by score.

### Why the noise term is the most important constant in the game

`NOISE` controls how often the visually obvious alpha is *not* the alpha. Set it to 0 and the puzzle is a lookup table — read the traits, done, no guessing. Set it too high and traits are decoration, the opening guess is random, and the theme stops paying rent.

The target: **an informed opening guess should be right more often than chance, and wrong often enough to hurt** — empirically, the trait-favorite should be the true silverback roughly 55–65% of the time. `NOISE = 2.7` as originally specified measured at ~78% against this codebase's actual trait-generation distribution (not the 55-65% target) and was retuned to `NOISE = 4.4` (see `troop.ts`), which measures at ~66.6%. The lesson generalizes: this constant is only ever correct relative to a specific implementation's random-generation choices, not a portable number — retune empirically whenever trait distribution logic changes, the same way it was retuned here.

**Constraint:** silvering is gated by age. Juveniles never exceed `flecked`; subadults never exceed `part-silver`. A full-silver juvenile is biologically absurd and would read as a bug.

---

## 4. Puzzle generation contract

Generation is **pure and deterministic**: `generate(dateKey, engineVersion) → Puzzle`. Same inputs, same puzzle, on any device, forever. No network, no clock beyond the date, no `Math.random`.

### Pipeline

```
seed = hash(`silbak::v{N}::{YYYY-MM-DD}`)
  ↓
buildTroop(rng)         → 6 apes, distinct names, gated traits
  ↓
score + sort            → true order
  ↓
candidateClues(order)   → ~62 named clues + ~80 trait-quantified clues,
                           all true of the solution
  ↓
selectClues(band)       → 2–4 clues leaving |space| within the day's band,
                           no single clue dominant, the set irreducible, and
                           at least one clue relational
  ↓
verify                  → brute-force all 720 permutations
```

Two hardening passes beyond the original spec, both in `select.ts`:

- **Dominance margin.** No chosen clue may, read alone, narrow to within a configurable multiple of the band ceiling — otherwise the generator happily picks one very strong clue and pads the rest with filler the player doesn't actually need. Current value: `DOMINANCE_MARGIN = 1.6`, with the threshold **capped at `DOMINANCE_CAP = 350`** (v0.11). Without the cap, any ceiling ≥ 225 pushes the threshold past 360 — the solo strength of `order` and `half` — and the weekend's primary pool collapses to `neg` plus the weakest trait clues; that is the mechanism behind the v2 weekend bug (see Difficulty bands). 350 keeps the two named relational kinds eligible at every ceiling while still excluding `adjacent` (240) and `count`/`between` (120), and changes nothing for Sunday–Thursday, whose thresholds were already below it.
- **Irreducibility.** No proper subset of the chosen clues may already reach band on its own — otherwise a 3rd/4th clue can ride along doing nothing. Checking single-clue removals is sufficient (removing a clue can only grow the surviving space, never shrink it), so this doesn't require enumerating all subsets.
- **A relational clue in every set** (v0.11). A set of nothing but `neg` / `t-rung` ("X is not the silverback", stacked) narrows the space on paper while telling the player nothing about who stands over whom — 29% of v2 puzzles, every Friday and Saturday, were exactly that, and testers described them as guesswork. `selectClues` now refuses a set with no clue from {`order`, `adjacent`, `between`, `half`, `count`, `t-order`, `t-adj`, `t-pair`, `t-zone`, `t-count`}; `neg` stays available (testers loved it when it names the trait favourite), just never as the only information.

### Clue types

**Named clues.** Cut percentages are exact (not estimates) — each is a fixed function of troop size N=6, independent of which specific apes or clue instance: `order` and `between` only depend on relative order among 2-3 elements, so they're N-invariant; `adjacent`, `count`, `neg`, `half` scale with N.

| Kind | Form | Cuts |
|---|---|---|
| `order` | "X steps aside when Y approaches." (X ranks below Y) | 50% |
| `adjacent` | "X and Y — no one ranks in between." | 67% |
| `count` | "N of the troop groom below X." — at the extremes, "X is the silverback." / "X holds the lowest rung." (v0.11: the giveaway reads like one instead of like arithmetic) | 83% |
| `neg` | "X is not the silverback." / "X does not hold the lowest rung." | 17% |
| `half` | "X ranks in the top three." / "…bottom three." | 50% |
| `between` | "Y ranks below X but above Z." (v0.11: the old "somewhere between X and Z" was read symmetrically by real players — 240 survivors — while the predicate was strict, 120) | 83% |

**Trait-quantified clues** (v0.11, `classes.ts` + `clues.ts`). These talk about a *class* — every ape sharing one visible trait value — rather than a named ape, so the player's first job is decoding which apes the clue is about. Their solo strength is a continuum (anywhere from ~50 to ~650 survivors, depending on the troop's class sizes), which is what fills the gaps between the named kinds' lattice points. Two rules, both learned while prototyping: a class is always 2–4 apes (size 1 is a named clue in a costume; the whole troop says nothing), and two classes in one clue never overlap (classes of different traits — a heavy ape who is also scarred — are only paired when their members are disjoint).

| Kind | Form |
|---|---|
| `t-order` | "Every elder outranks every subadult." |
| `t-zone` | "Every scarred ape ranks outside the top two." / "Every juvenile ranks in the bottom three." |
| `t-rung` | "The omega is a juvenile." / "The silverback is not full-silver." |
| `t-adj` | "The two heavy apes hold neighbouring rungs." / "…do not hold neighbouring rungs." / "The three elders hold three consecutive rungs." |
| `t-count` | "Exactly one of the three flecked apes ranks in the top three." |
| `t-pair` | "A prime stands directly above a part-silver ape." (existential) |

Every class carries its own wording (`singular`, `article`, `plural`, `is`, `isNot`) in `classes.ts`, chosen to match the labels on the rung exactly — "part-silver", "flecked", "ape with no silver" — so the decode step is a lookup, not a guess. Measured over 364 days, a trait clue appears on 65–100% of days depending on weekday and makes up the whole set on 2–55%; `test/diversity.test.ts` holds the overall figures to ≥60% / ≤40%.

Phrasing rule: **clarity beats flavor whenever flavor could change the parse.** "Feeds in the first wave" is atmospheric and ambiguous; "ranks in the top three" is not. Atmosphere lives in the verbs, never in the relation.

### Difficulty bands

The generator targets a *surviving solution space*, not a difficulty label. Fewer survivors = easier.

| Day | Band | avg space | par | distinct spaces / kind signatures (364 days) | Feel |
|---|---|---|---|---|---|
| Mon | 16–44 | 34 | 3 | 12 / 41 | Nearly deducible |
| Sun | 24–60 | 48 | 3 | 13 / 35 | Soft landing |
| Tue | 72–135 | 116 | 4 | 15 / 35 | |
| Wed | 135–195 | 172 | 4 | 18 / 29 | |
| Thu | 195–224 | 210 | 4 | 12 / 31 | |
| Fri | 225–300 | 272 | 4 | 14 / 26 | `order`/`half` + `neg` or trait mixes |
| Sat | 288–400 | 343 | 5 | 16 / 14 | A trait clue in every set; deduction sets the frame |

Par is the expected guess count for the weekday (§5); the bands are what generation targets, par is what the player is told.

**A structural trap worth documenting, because it silently produced a real bug twice:** `DOMINANCE_MARGIN` filters candidate clues by a *fixed* solo-survivor count per named kind (order/half=360, adjacent=240, count/between=120, neg=600 — see the pipeline note above), which gives the eligible-clue pool hard edges at certain ceilings. Before v0.11, in the zone `225 ≤ ceiling < 375` only `neg` clues cleared the margin, and stacking `neg`-only clues lands on a **sparse fixed lattice** of achievable spaces — {240, 288, 312, 336, 360, 384, 408, 480, 504} — not a continuum, because "not silverback"/"not lowest rung" on *k* apes is a clean inclusion-exclusion count. A naive proportional scale-up of the v0.2 bands put Friday's band entirely inside that zone at a single lattice point, and it landed on the identical `space=240` for **286 out of 286** sampled Fridays. Widening Friday to 240–360 diversified the *count* but not the *kind* — every Friday was still `neg`-only, and Saturday (360–504, where the margin emptied the pool entirely) was two `neg` clues every single week. The in-band test could not see either bug, because both were in band.

v0.11 fixed the mechanism rather than the symptom: the dominance threshold is capped at 350 so `order`/`half` are eligible at every ceiling; the trait-quantified clues supply a continuum of solo strengths between the named lattice points; every set must carry a relational clue; and `test/diversity.test.ts` asserts ≥4 distinct spaces and ≥4 kind signatures per weekday over 105 samples each. Any future band change should be checked against that test, not just against in-band rate. With the relational rule an `order`/`half` clue alone leaves 360, so bands with a floor above 360 are unreachable by construction; Saturday's is deliberately below it.

**Guesses-to-solve payoff** (trait-greedy solver, count-only `grade()`, 364 days — the same solver whose 2.10 average under binary feedback motivated the change): Mon 2.2 · Sun 2.4 · Tue 2.5 · Wed 2.6 · Thu 2.8 · Fri 3.0 · Sat 3.0, with 30–32% of weekend puzzles needing 4+ and no losses at 6. Space stops predicting solver difficulty much past ~250; what Saturday buys over Friday is that every set carries a trait clue (55% are trait clues only), and the decode step is human cost the solver doesn't pay. The minimax sweep in `difficulty-simulation.test.ts` (which ignores traits) sits at 4.4–5.3 guesses for space ≥ 100, 100% solved within 6 — the gap between the two solvers is the value of reading the room, and it is the gap a trait-blind human falls into. Blind agent playtest results for v3 are recorded in §9.6.

Selection is greedy over a shuffled clue pool: add a clue only if it strictly reduces the space and does not push it below the band floor; once the space is under the ceiling but the set has no relational clue yet, only relational clues are considered; stop at the band ceiling (with a relational clue present) or four clues, whichever comes first. Retry with a reshuffled pool up to 240 times (180 against the "no dominant clue" pool first, remainder against the full pool as fallback); if nothing lands in band and is irreducible, fall back to the best in-band-but-reducible result, then to the nearest miss. Neither fallback has been observed to fire over 364 days of v3 output; they are a safety net, not a path puzzles take.

**Invariants the generator must satisfy (assert in tests):**

- Every emitted clue is true of the true order.
- The true order is always a member of the surviving space.
- `2 ≤ clues.length ≤ 4`.
- `space ≥ 2` — never fully determined.
- No single clue dominant (dominance margin); clue set irreducible where the search budget allows.
- At least one relational clue per puzzle; ≥4 distinct spaces and ≥4 kind signatures per weekday over ≥100 samples (`diversity.test.ts`).
- Identical output across Node, browser, and CI for the same seed.

---

## 5. Share format

```
Silbak #219  4/6 · par 3
🍌🍌🪨🪨🪨🪨
🍌🍌🍌🪨🪨🪨
🍌🍌🍌🍌🪨🪨
🍌🍌🍌🍌🍌🍌
```

Each row is the guess's count — `exact` bananas, then rocks — so a row is a bar, not a map. A solve in one reads `1/6 · par 2 🥇`.

Rules, non-negotiable:

- **Banana and rock only.** This was originally framed as hiding directional arrows; then as hiding which rungs were right. As of v0.11 the row *is* only a count, so the share grid reveals strictly less than the board does — the safest it has been.
- No ape names, no traits, no clue text.
- Loss renders `X/6` and shows all six rows.
- Line 1 is the only text. Puzzle number, not date — dates cause timezone arguments.
- Optional trailing streak line (`🔥 12`) once streaks exist. Off by default.

### Par (v0.11)

With a real weekly curve the guess count means something different on Monday and Saturday, so the score says so. Every weekday has a **par** (`PAR` in `select.ts`, exposed as `puzzle.par`): Mon 3 · Tue–Thu 4 · Fri 4 · Sat 5 · Sun 3 — the v3 blind playtest's per-weekday medians (§9.6) smoothed into the modelled Mon→Sat ramp, about one guess above the proposal's hypothesis, since even attentive players sit well above the trait-greedy model under count feedback. Provisional until a month of real `played` entries exists. The share line carries it; the result card reads "On par" / "One under par" / "Two over par"; and the stats strip shows **vs par this month** — the sum of `guesses − par` over the month's daily results, a loss counting as `MAX_GUESSES + 1` strokes (one worse than the worst solve). That number is what a regular can chase that a streak can't: playing *well* on hard days. Par is recorded on each `played` entry at the terminal submit, so a later re-tune doesn't rewrite history.

The **clean read** marker (🥇) is a solve in one — a perfect read of traits and notes. A perfect trait reader hits it on ~14% of days; humans far less. It is the rarity badge the game lacked.

Not done, deliberately: time scoring and point-per-rung scoring, which both fight the 90-seconds-once product thesis.

**Copy target:** `navigator.clipboard.writeText`, with `navigator.share` on mobile where available, falling back to a selectable textarea. Never fail silently — the button label is the receipt (`Copy result` → `Copied to clipboard`).

---

## 6. Visual system

The world is still a primatology field station in montane cloud forest, not a zoo — but as of v0.4 it's the station at midday, not at night. Reference material shifted from a dim observation log to the same log read in bright sun: same institutional voice, same typed field-note register, but with real color in it. The brief was explicitly "lighter and fun, Donkey Kong colors" — a warm sunlit clearing rather than a research tent, without giving up the field-journal identity.

### Tokens

```
--paper   #FBEFD3   page ground (warm banana-cream) + text/highlight on dark panels + the eye glint on portraits
--forest  #1C2E19   ink — primary text, focus ring
--bark    #186B37   chips, dev-only panels — the "make the green lighter" token
--card    #2A7744   panel green as of v0.7: the Rung, result card, field notes, archive list
--rock    #E3C08A   wood-tone: portrait frame background, inert/disabled, hover borders
--mist    #C9E0BC   secondary text on card panels (rank, traits, "wrong rung" feedback)
--moss    #463A28   secondary text directly on the page ground (eyebrow, rules, nav links, notes) + the selected rung's surface (v0.8)
--banana  #FFC93C   the single hot accent: correct rung, share glyph
--blood   #E14E2E   scar mark only (no longer "ranks lower" — feedback is non-directional as of v0.2)

--fur-deep  #1A1614   portrait ink: silhouette outline, far limbs, shadow masses, brow/eye/nostril/mouth
--fur       #2E2622   portrait base fill: torso, near limbs, head
--fur-light #5A4D44   portrait lit fur: hump top, crown, forearm and shin bands
--skin      #5C5654   portrait bare skin: face, ear, knuckle pad, sole
--silver    #C2BEB6   portrait silver: saddle, flecks, elder greying
```

The five `--fur*`/`--skin`/`--silver` tokens are the portrait's and nothing else's (v0.6). They exist so the gorilla can be a gorilla-colored gorilla without the page's greens having to bend around it. One caveat is load-bearing: `--silver` is luminance-matched to `--rock`, the disc the portrait sits on (~1:1). Silver must therefore never reach the silhouette edge unbounded — the portrait keeps a `--fur-deep` outline between any silver and the frame (see Portraits).

`--sky` (`#7FA8C9`, formerly "ranks higher") was removed in v0.2 — it has no remaining use now that feedback is binary.

`--banana` is reserved. It marks correctness and nothing else — not buttons that aren't the primary action, not decoration, not hover states, not selection. (The focus ring used to borrow it; that stopped in v0.4 — see below. The selected rung's border was still borrowing it up to v0.8 — see next.)

### The selected rung (v0.8)

Selection used to be a `--banana` border and a 5px nudge. Two things were wrong with it: it broke the reservation above, and on a ladder where all six rungs are the same green a recoloured 1px edge is genuinely hard to spot — players tap a rung and can't tell they've armed a swap. Selection now changes the **whole surface**: the rung goes `--moss` with a `--rock` ring and a 10px nudge, so it reads as picked up off the ladder rather than outlined on it. `--moss` against `--card` is 2.0:1, which is the jump that does the work.

The colour had to be a *dark* one, and that's the load-bearing part. A rung can be selected while the last guess's feedback is still on the board, and everything already printed on a rung is light — the name (`--paper`), the traits and "wrong" glyph (`--mist`), the "correct" glyph (`--banana`), the portrait's `--rock` disc. On `--moss` those hold 9.7:1, 7.8:1, 7.2:1 and 6.4:1 respectively. The light-surface version was tried first and rejected on exactly this: `--banana` on `--rock` is **1.12:1**, so picking up a rung that had just been marked correct erased its glyph. Any future restyle of this state has to survive the same test — select a rung that is showing `■` and look at it.

### Why there are two "secondary text" tokens now

`--forest` and `--paper` used to map directly onto "page ground" and "primary text" — one dark value, one light value, and everything else was built relative to those two. Going lighter broke that: the page ground had to become the light value and primary text the dark one, which is a straight swap and cost nothing. But `--mist` (the old secondary-text color) couldn't make the same trip. It's used in two structurally different places — as light-on-dark text inside bark panels (rung traits, field-note headers), and as muted text sitting directly on the page ground (the eyebrow line, nav links, rules copy). Those need opposite lightness once the page ground is light: a color dark enough to read on cream paper is, almost by construction, too dark to read against a green panel that's still deliberately mid-dark (see below), and vice versa. Rather than pick one and accept broken contrast in the other context, `--mist` stayed light (for bark panels) and `--moss` was added dark (for the page ground) — two tokens doing the one job "secondary text" used to do alone, split by which surface they sit on.

### Why the panel green didn't go all the way to pastel

The obvious reading of "lighter" is: make every green as light as the new cream page ground. That was tried and reverted, for two reasons that both trace back to `--banana` and the ape portraits:

- `--banana` (`#FFC93C`) is a light, warm yellow. Against a light or pastel panel it nearly disappears — the "correct rung" signal is the one piece of color that must never wash out. Against the current `--bark` (`#186B37`, deliberately kept mid-dark) it holds ~4.3:1, which is what makes a rung glow gold on submit instead of just faintly tinting.
- *(Retired in v0.6, kept as a documented reversal.)* Through v0.5 the ape portraits were built from exactly three of these tokens by *value*, not by name: `--forest` the darkest thing on the glyph, `--bark` the mid-value body fill, `--paper` the lightest (eye dot, fur speckles, full-silver mantle). That pinned `--bark` from above — if it drifted toward `--paper`, the eye and the silvering stopped popping off the body — and it is why the panel green was kept at `#186B37` rather than lighter (`#16251D` → `#186B37` is roughly a 14x jump in relative luminance — very much "lighter," just not pastel). As of v0.6 the portrait owns its own palette (`--fur-deep`/`--fur`/`--fur-light`/`--skin`/`--silver`, above) and places no constraint on the page greens at all. The `--banana` contrast reason in the previous bullet is the only one that still holds, and it is sufficient on its own.

So the panel green got vivid, not pale — and although the portrait no longer needs it dark, `--banana` still does. "Lighter" landed on the page ground (which has no such constraint) and on making every green in the palette a *real* green instead of a near-black one, rather than on flattening the whole app to one brightness band.

**v0.7** revisits this rather than relitigating it: every panel, including the Rung, moved to a new `--card` token that's lighter than `--bark` but stops well short of pastel. `--card` is chosen to stay under the luminance ceiling `--banana` needs — still >=3:1 against it — while clearing 4.5:1 against `--paper`/`--mist` body text. The Rung's "correct rung" glyph is the tightest case (it's the exact signal the first bullet above is about), so at `--card`'s lightness it only clears that 3:1 floor as *large* text; the glyph moved from regular/1.1rem to 700/1.2rem to qualify. `--bark` itself didn't move — it's still used for panels that aren't "cards" (attempt-history chips, `/dev/apes`).

### Wood and red, brought forward

`--rock` (portrait frame background, disabled state, hover borders) moved from a desaturated gray-green to an actual warm wood tan (`#E3C08A`) — the Donkey Kong crate/barrel note the brief asked for. `--blood` moved from a dull brick to a more saturated red-orange (`#E14E2E`); its role is unchanged (scar mark only) but it reads as a proper accent color now instead of a muted warning tone.

### Type

One superfamily, three roles. IBM Plex is chosen because institutional research documentation is exactly its native register.

| Role | Face | Use |
|---|---|---|
| Display | IBM Plex Sans Condensed 700 | Title, ape names, result headline |
| Body | IBM Plex Sans 400/500 | Field notes, prose |
| Utility | IBM Plex Mono 400/500 | Rank labels, traits, counts, all data |

Everything that is *data* is mono. Everything that is *voice* is sans. That split is the whole typographic idea; keep it clean.

### Portraits

Ape portraits are **generated from traits**, never picked from a library. As of v0.6 they are a layered retro-vector cel in natural gorilla colors — charcoal fur, grey skin, grey-white silver — drawn by `ApeGlyph.tsx` and nowhere else.

**Pose.** The knuckle-walking quadruped profile of the **gorilla emoji** (U+1F98D), facing left, with proportions measured off it rather than eyeballed. Profile was kept over a 3/4 view deliberately: every trait tell lives on the silhouette edge (crest on top of the skull, muzzle at the front, hump on top of the back, saddle along the back), and a 3/4 view turns the saddle's extent into an interior shading problem while adding a second eye and far cheek that are pure noise at 56px. Two of the proportions are counter-intuitive enough to have been got wrong repeatedly, and are worth restating because any future re-tune will hit them again:

- **The head is the highest point, not the shoulder hump.** The hump sits behind the crown and about a fifth of the body's height lower.
- **The torso is far wider than it is deep** (roughly 1.75:1). A torso that approaches circular reads as a bear regardless of what the head and limbs are doing.

And the head must overlap the chest deeply — any exposed neck reads as a canid instantly.

**Rendering.** One ink outline, one base fur value, then flat shadow and highlight masses clipped inside each part, lit from the upper left:

1. Every part of the near silhouette (torso + hump, near limbs, head + crest) is drawn once as an *underlay* — filled *and* stroked in `--fur-deep` — and then again on top, filled in `--fur` with no stroke. The union of the underlays is the outline; the union of the fills covers every interior seam. Where a limb is buried in the chest, its stroke is simply painted over, so no contour is ever drawn there. This replaces the v0.4 mechanism (one fill value plus `--forest` contours clipped to the area *outside* the torso) but keeps its two lessons: never give the torso and limbs different *base* fills (the silhouette breaks into a shell sitting on tubes), and never stroke a limb's buried edge (the limbs read as boots).
2. Shading is clipped to the part it belongs to, in that part's own coordinate space, so it rides along with the trait transforms. Torso: belly shadow, jaw shadow, hump highlight, back highlight. Limbs: a lit band down the leading edge, a shadow down the trailing edge, `--skin` knuckle pad and sole. Head: crown highlight, shadow where it meets the chest, the `--skin` face mask (brow shelf, eye socket, cheek, whole muzzle), ear, heavy brow ridge, dark eye with a `--paper` glint, nostril, mouth, cheek crease. Far limbs are outlined like everything else and then washed darker so they recede.
3. **Silver never touches the frame.** `--silver` and `--rock` are the same luminance, so the saddle is clipped to the torso and an inner `--fur-deep` rim is re-stroked along the back *after* it. That rim traces the union of torso and hump only — stroking the hump ellipse in full draws a ring on the fur, which is exactly what happened first.

**Trait encoding**, each exaggerated enough to read at 46px:

| Trait | Tell |
|---|---|
| Age | Whole-animal scale (juveniles stand shorter), head size relative to body (juveniles largest), sagittal crest height (none / low / mid / tall), muzzle length, eye size (juveniles largest), and greying — elders get a `--silver` wash on the brow, temple and crest tip |
| Build | Torso scale about the belly line, limb thickness, and the **shoulder hump** — an ellipse riding on the withers whose vertical radius is the single most legible build tell at 56px |
| Silver | A saddle that grows in *area* along the withers→rump axis, not just in opacity: `none` is bare fur with a few dark hairs; `flecked` is a scatter of light hairs over the upper back with only a faint patch under them; `part-silver` is a solid patch to mid-back with hairs growing in at its edge; `full` runs to the rump and continues onto the near thigh. The patch edge is scalloped so it reads as fur, not a waterline |
| Scar | One short diagonal `--blood` cut down the bare cheek, under the brow and behind the eye, over a faint dark edge. It sits on the `--skin` mask on purpose: a red stroke over near-black fur reads as a painted bar (the first v0.6 draft ran it from the crown and looked stuck on), over grey skin it reads as a healed wound. It must never paint over the eye |

The engine's gating (juveniles carry at most `flecked`, subadults at most `part-silver`) makes 78 valid portraits. **`/dev/apes`** renders all of them, at 56px and at 46px, on the same `--rock` disc a rung uses; it is mounted only under `import.meta.env.DEV` and is the only test the portrait has. Eyeball the whole matrix after any change to the tables in `ApeGlyph.tsx`.

A player should be able to read a rung before reading its label. Rung portraits render at 56px. If portraits stop being legible at 46px, simplify the silhouette rather than enlarging the glyph.

### The canopy scene: a page-level pixel-art backdrop

`CanopyScene.tsx` is a purely decorative layer (`aria-hidden`) mounted once at the app root (`App.tsx`) behind the nav and every route — a nod to 8-bit title-screen framing (blocky foliage, drifting motes, a scanline overlay), reworked into the jungle setting rather than copied wholesale. Deliberately **not** a gate: no click, no route, no loading state — the puzzle is exactly as immediately visible/playable as before, so "learnable in one turn" (§1) still holds.

**As of v0.5 the scene is a stack of height-agnostic layers, not a tiled `<pattern>`.** The brief was "lush forest, feel like you're really in the jungle." Getting there meant discarding the tiling architecture entirely, for reasons documented below — the three earlier revisions are kept because each one's mistake is still live as a temptation.

#### Revision history (the mistakes are the point)

- **First pass boxed it into the header as a bounded card**, with a jagged waterline filling roughly the bottom half in `--bark`. That filled zone ran behind the rules text and made it unreadable, and on a small card the effect just looked cramped rather than atmospheric.
- **Second pass promoted it to a page-level band, but got the positioning wrong**: `position: fixed` at a fixed 240px height pins an element to the *viewport*, not the page — it covered only the first screenful and vanished the instant you scrolled.
- **Third pass moved to an SVG `<pattern>`** (`patternUnits="userSpaceOnUse"`) filling one rect at `position: absolute; inset: 0`, on the theory that a pattern repeats natively and therefore covers whatever height the route has with no measurement code. Also replaced the waterline and an earlier conifer silhouette (three tapering tiers stacked pyramid-style reads as a pine no matter what color it's filled) with `PixelTree`, a broadleaf shape: a bare `--rock` trunk under a `--bark` foliage mass that bulges in the middle and tapers at both ends.

#### Why the `<pattern>` approach was abandoned in v0.5

The broadleaf-vs-conifer lesson survived. The architecture did not. Three defects, all measured in the running app:

- **Nothing inside `<defs>` ever animated.** The third pass claimed "the canopy sways — each tree's foliage group rotates independently, staggered per tree." That was true of the source and false of the screen. Pattern content lives in `<defs>`, which is not in the render tree; it is rasterized once and stamped. `getAnimations()` dutifully reported the sway `running`, but the group's computed transform stayed `none` (a `transform-box: fill-box` element has no fill box when it is never laid out) and the mote sat frozen on its 0% keyframe. **Anything that must move has to live in the rendered document** — this is the single most transferable fact in this section, and it cost a whole revision to learn.
- **The tile height had to be measured, and the measurement silently didn't land.** To avoid a short motif repeating down the page like a stripe, the tile's height was set to the page height via `ResizeObserver`. In practice the pattern stayed at its initial `800` against a ~1040px page, so the tile restarted mid-page: a hard ground line straight across the middle with a cropped second row of treetops beneath it. Note the failure mode — the *fallback* for a missed measurement is a visible seam, so the bug was invisible in code review and obvious on screen.
- **It read as wallpaper, because it was wallpaper.** One 220px tile — two trees, a cloud, a vine — repeated ~6× across at identical art and identical phase. A pattern cannot produce variety; that is what a pattern is for.

#### The v0.5 architecture: vertical elements, edge-anchored bands, percentage placement

The insight that removes the measurement problem entirely: **a trunk is vertical, so `top: 0; bottom: 0` covers any page height natively.** Nothing needs to know how tall the page is.

- **Trunks** are DOM elements spanning the full page height, six of them, at percentage `left` offsets, with width/color/opacity varying by depth.
- **Canopy and understory** are edge-anchored SVG bands (top and bottom) using `preserveAspectRatio="… slice"`, so shapes keep their proportions on any width instead of stretching.
- **Boughs and motes** are placed at `top: X%`, so they redistribute down a long archive page and a short daily page alike.
- **No `ResizeObserver`, no tile, no seam.** Verified covering the full page height on both routes at 375px, 785px and 1440px.

#### Composition: a clearing, not a wall

The scene is dense at the left/right margins and the top/bottom bands, and light through the middle. This is not just taste — the board is a fixed 560px centered, and §6 requires `--bark` cards to keep their contrast against whatever sits behind them. Foliage is therefore kept out of the card column outright (verified: zero foliage ink overlapping the rung zone at desktop widths), which has the happy side effect of framing the content like a clearing seen from inside the treeline. That framing is what actually sells "standing in the jungle" rather than "looking at a picture of trees."

The available margin is `(100vw − 560px) / 2`, which collapses fast, so the scene sheds detail in tiers rather than scaling: `inner` elements drop below 1200px, `mid` ones (and all boughs) below 1024px, and below 720px only the top and bottom bands remain. Shedding beats shrinking — a scaled-down bough detaches from the trunk it is supposed to grow from, and a merely faded one still sits behind a `--bark` card.

#### Density and occlusion

An independent review of the first v0.5 cut called it "a beige sheet of paper with jungle stickers stuck around the border," and measured the right-hand third of a 1920px render as roughly 90% empty. That was fair, and the fix was **not** simply more elements:

- **Occlusion, not just count.** Boughs render in two planes — one *behind* the trunks, one *in front* — so trunks cut across far foliage and near foliage hides parts of trunks. With a single layer, every bough drew over every trunk, nothing was ever hidden by anything, and the scene read as flat decals no matter how many were added. Overlap is what reads as a thicket; density alone reads as scattered stickers.
- **Trunks are spaced closer than a bough is wide** (3.5–5% apart, i.e. 50–70px at desktop widths, against ~200px boughs). That spacing is deliberate and guarantees crossing without hand-placing every intersection.
- **A near plane that runs off the edge.** The darkest foliage (`DEEP`) sits in the bottom corners, cropped by the viewport. A near plane that leaves frame is the strongest cheap cue that the viewer is standing *inside* the scene rather than looking at it from outside.

The counts that resulted: 12 trunks, 19 boughs, ~20 understory fronds, ~20 canopy masses. All of it still stays out of the card column — verified as zero foliage ink overlapping the rung zone.

One structural criticism from that review was **not** acted on and is recorded here so it isn't rediscovered as new: the reviewer argued the scene can never fully read as "inside a jungle" while the environment and the page share one cream value, and proposed inverting the ground — jungle as the page, the field notebook as a card floating on it. That is probably correct, and it was declined deliberately: it would reverse §6's v0.4 decision that the page ground is `--paper` and would change every route's appearance. Revisit it as a v0.6 question, not as a bug.

#### Motion

Six independent ambient loops: three canopy depths swaying at different amplitudes and periods, vines, boughs, fronds, drifting motes, and breathing sun shafts. Periods run 7–17s and are deliberately not multiples of each other, so layers drift out of phase instead of pulsing on a detectable beat. Far foliage barely stirs and near foliage moves most — a parallax of *motion*, not just of color, which is what keeps the canopy from reading as one flat cutout.

All of it is ambient background texture and never feedback; no puzzle state is communicated through motion. `prefers-reduced-motion` is handled by the global `*` rule in `global.css`, so these loops need no separate opt-out.

#### Tokens

- **Still no new tokens.** Sky is `--paper` washed with `--mist`; foliage is `--bark`; trunks `--rock`; shading `--forest`/`--moss`; motes and sun shafts `--paper`.
- **Depth comes from `color-mix()` blends of existing tokens**, not new ones — far foliage washes toward `--paper`, near foliage sits at full `--bark` with `--forest` shading. Atmospheric perspective for free, palette unchanged.
- **`--banana` stays out of the scene entirely**, reserved for correctness per §6, even where a firefly would have been a natural fit.
- **The title's chromatic fringe is unchanged since the first pass.** `--blood` and `--bark` are layered as offset `text-shadow`s on both title spans — a two-tone glitch fringe standing in for the reference's cyan/pink, using colors already in the palette. `-webkit-text-stroke` on the banana span still does the real legibility work; the fringe is texture on top of it.

#### Depth has to be a real value ladder, not a label

Two colour mistakes in the first v0.5 cut are worth keeping, because both looked correct in the source and wrong on screen:

- **The far foliage and the sky were the same colour.** `FAR` was `mist 74% + paper`; the sky's lowest stop was `mist 72% + paper`. Distant leaves dissolved into the background and the whole upper scene read as pale blocky mush — worst on mobile, which is almost entirely far layers. Fixed from both sides: the foliage ramp now starts at `bark 16% + mist` and the sky was lightened to top out at `mist 40% + paper`, so the two ranges no longer meet. **"Lighter with distance" only reads as distance while the shape still separates from what's behind it** — atmospheric perspective is a ladder of values, and a ladder with two rungs at the same height is a hole.
- **Shading and branch colour have to track depth too.** Boughs originally shared one branch colour (`--forest`) and gave shading only to the near ones. On a pale far clump that dark branch read as a stick laid across it, and the unshaded clumps read as flat clouds floating in the page rather than foliage. Every bough now carries a depth-appropriate `shade` *and* `branch`. Related: a bough has to visibly touch a trunk — the right-hand boughs were initially positioned by `left` like the left-hand ones, which left their branch pointing into open air.

The same trap caught the light elements, in the opposite direction. **Sun shafts and pollen motes were filled with `--paper` over a sky that is itself nearly `--paper`** — both invisible. `--paper` is already the lightest token, so "brighter than the sky" has nowhere to go; those elements now separate by *temperature* instead, filled with warm `--rock` against the sky's cool `--mist` tint. (`--banana` is the natural choice for sunlight and stays reserved for correctness per §6 — that reservation is why the mix leans on `--rock`.)

Anything decorative added here should be checked against the same question: what value sits behind this, and does the shape still separate from it at every depth and every breakpoint?

#### The scene sits behind text, so contrast is a scene constraint

Decorative or not, this layer is a background for real text, and two AA failures were introduced by treating it as purely decorative and shipped past visual review — both only caught by sampling rendered pixels:

- **Nav links over the canopy.** `--moss` nav text landed on mid-green canopy masses at **2.05:1** (and 2.87:1), against §8's 4.5:1 floor, at every width tested. Fixed by keeping the two canopy masses in the nav's x-range pale and raising them. Anything dark added to that x-range has to be re-measured against the nav.
- **The guess counter over the understory on mobile.** The understory anchors to the bottom of the page and the guess counter is the last thing on the page, so on a narrow screen they necessarily overlap — no placement avoids it. At full strength that text sat at **2.36:1**; the mobile understory is held to a faint wash to keep it above 4.5:1. Desktop is unaffected (4.87:1) because the wider band puts paler fronds there.

The lesson generalises past this component: "decorative" describes intent, not the contrast obligation. `packages`-free pixel sampling (screenshot, hide the text, measure the backdrop under each glyph box) is the only reliable check here — computed styles can't see it, because the text and the thing behind it are in different stacking layers.

#### One more trap, since it shipped once

The foliage generator seeds a small LCG per element (`900 + i * 17`, trunks at 11/22/33…). A bare LCG's **first** output is very nearly a linear function of its seed, so callers seeded a fixed distance apart get first values marching in lockstep — the 16 motes landed at x = 57.8%, 58.4%, 59.0%, … a perfectly linear ramp that bunched every one of them into a single narrow stripe. Fixed by hash-mixing the seed and warming the stream before first use. Any future "why does this procedural placement look weirdly regular" should check the seeding before the placement logic.

### Motion

One orchestrated moment: on submit, rungs flip on X with an 80ms stagger, then feedback lands. Selection nudge (5px translate) and focus rings are the only other things that moved before v0.4.

**The swap (v0.8).** Committing a swap moves two cards, and until v0.8 they teleported: the arrangement changed under the player and nothing said which two rungs had traded. The swap is now a FLIP — positions are measured in the click handler, *before* the store reorders `arrangement`, and each moved rung is animated from where it was to where it now is over 260ms on a symmetric ease-in-out. Three details are what make it read as a trade rather than two unrelated slides: the rungs lean 10px out of the column in opposite directions, so they pass *around* each other instead of through; the one climbing the ladder goes in front and swells 4% while the one descending dips behind at 97%; and the rising card wears a drop shadow for the length of the flight, because two identical green cards overlapping are otherwise one indistinct shape. 260ms is deliberately slower than the selection change (`--motion-fast`, which should feel instant under the finger) — the swap is the one move the player actually makes on the board.

Two traps this hit, both worth keeping:

- **`prefers-reduced-motion` is not free here.** The global `*` rule in `global.css` collapses CSS animations and transitions, and everything that moved before v0.8 was one of those. The swap flight is a Web Animations API call, which that rule cannot see, so it has to check the media query itself. Any future motion driven from JS has the same obligation.
- **Measure with `offsetTop`, not `getBoundingClientRect()`.** The "First" measurement is a layout position, and a bounding rect is neither scroll-independent nor transform-independent — it would fold both the page's scroll offset and any flight still running from an interrupted swap into the delta, and the card would jump.

As of v0.4, the canopy scene (previous section) adds a second, deliberately separate category: slow ambient drift — canopy sway, mote bob — confined entirely to that decorative backdrop and never gated behind a submit or a player action. It's allowed to be continuous specifically because it's decorative background texture, not feedback; nothing about the puzzle's state is communicated through it. All of it, old and new, respects `prefers-reduced-motion` — the global `*` rule in `global.css` collapses every `animation-duration` to near-zero under that query, so the ambient loops didn't need their own opt-out.

---

## 7. Screens

```
┌─────────────────────────────┐
│  eyebrow: log · Troop #219  │
│  SILBAK                     │
│  one-line rules             │
├─────────────────────────────┤
│  FIELD NOTES        3 obs.  │
│  ▸ ...                      │
├─────────────────────────────┤
│  ① [portrait] NAME          │
│     prime · heavy · full    │
│  ② ...                      │
├─────────────────────────────┤
│  GUESS 2   4 of 6 on their  │
│            true rung.       │
├─────────────────────────────┤
│  [ SUBMIT RANKING ]         │
│  4 guesses left · par 3     │
├─────────────────────────────┤
│  LEDGER     1 2 3 4 5 6     │
│  KANZ       ✗ · · ✓ · ·     │
│  NDOK       · · ✗ · · ·     │
│  ...                        │
├─────────────────────────────┤
│  ATTEMPTS                   │
│  #1  HESH BARA TAJI ... 3/6 │
│  #2  BARA HESH TAJI ... 4/6 │
└─────────────────────────────┘
```

Each attempts row shows the full submitted arrangement and its count: one cell per rung, a four-letter name clipped from the ape's full name, then a `n/6` badge (`--banana` when n > 0, since a count of correct rungs is exactly what that token means). With count-only feedback the history is the primary deduction surface — the fact "guess 3 moved only Kanzi and dropped from 3 to 2" lives in two rows — so it can't be glyph-only chips. The ledger (§2) sits between the controls and the history. The submit button (and the keyboard path in the store) refuses to resubmit an arrangement identical to the last graded one, since that guess teaches nothing new. A visually-hidden `aria-live` region announces each guess's count.

Result state replaces the submit block with headline, the par line ("Two over par · par 3", or 🥇 for a clean read), the banana/rock grid, a stats strip (played, win %, streak, best, vs par this month — daily only), and the copy button. The archive (`/archive/:number`) reuses the identical board with a date header, no streak effect, and no stats.

---

## 8. Accessibility

- Rungs are `<button>` elements in DOM order; tab moves down the ladder, Enter selects/swaps.
- Feedback is a number in words ("4 of 6 on their true rung"), never colour-only; ledger marks are `✗`/`✓` glyphs with `aria-label`s, and the grid uses `role="grid"` with row/column headers.
- Selection is never color-only either: the selected rung carries `aria-pressed`, its label ends "Selected, choose another ape to swap with", and it is nudged 10px out of the column.
- Contrast (recomputed for the v0.4 palette): `--forest` on `--paper` (primary text on the page) is ~12.7:1; `--moss` on `--paper` (secondary text on the page) is ~9.7:1; `--paper` on `--bark` (name text on a rung) is ~5.75:1; `--mist` on `--bark` (secondary text on a rung) is ~4.65:1; `--banana` on `--bark` (the correct-rung glyph) is ~4.3:1. Verify any new pairing at 4.5:1 minimum — `--banana` on `--bark` is the one pairing that runs slightly under that on paper, tolerated only because the ■/○ glyph shape (next bullet) already carries the signal independent of color. Portrait pairings (v0.6): `--fur` on `--rock` (the silhouette on its disc) is ~8.6:1; `--silver` on `--fur` (the saddle on the body) is ~8.5:1; `--silver` on `--rock` is ~1:1, which is why the portrait keeps a `--fur-deep` outline between any silver and the frame. Selected-rung pairings (v0.8, all on `--moss`): `--paper` name 9.7:1, `--mist` traits and "wrong" glyph 7.8:1, `--banana` "correct" glyph 7.2:1, `--rock` portrait disc and ring 6.4:1 — the whole point of that surface being dark (see §6).
- `aria-live="polite"` region in the board announces each guess's count ("Guess 2: 4 of 6 on their true rung"); the result card has its own.
- Full keyboard play with no pointer.
- Target size ≥ 44px on every interactive element.

---

## 9. Open design questions

1. ~~Four clues may be one too many.~~ Superseded — clue count is now governed by the dominance-margin and irreducibility checks (§4) rather than a raw count cap; instrument guesses-to-solve distribution again after the v0.2 changes settle.
2. ~~Five apes vs six.~~ **Resolved in v0.3 — switched to six.** Prototyped as an isolated parallel engine (`packages/engine/src/proto6/` at the time), validated via simulation (avg guesses climbs to ~3.3-3.5 at the new ceiling vs 5-ape's ~2.9 max, first-ever 5-guess optimal-play trials) and a 75-puzzle agent playtest (avg 2.17 vs 5-ape's 1.87, 0 losses either way), then promoted to replace the 5-ape engine outright. The seventh-guess concern didn't materialize — 6 guesses stayed sufficient at every difficulty level tested, including the 504-permutation structural ceiling. One real caveat surfaced by the playtest, not resolvable by simulation: hand-tracking six traits felt like genuine bookkeeping overhead via a CLI harness; worth watching whether the real visual ladder UI keeps that feeling like reasoning rather than tedium.
3. ~~Should traits be hidden until guess two?~~ **Closed in v0.11** — traits are worth 0.8 guesses under binary feedback and 1.45 under count feedback, so hiding them would matter more and hurt more; it also breaks "learnable in one turn". Recorded in `docs/DIFFICULTY-2026-09-13.md` Part 4 with the other ruled-out levers (seven apes, fewer guesses, an unreliable note, observe-or-submit, hard mode — probing was measured worth 0.03 guesses).
4. ~~Hard mode.~~ **Closed in v0.11** — there is no per-rung `exact` to lock any more, and consistent-guess enforcement was measured at no difficulty effect for a logical player.
5. ~~Streak semantics.~~ **Resolved in v0.10.** Archive is practice — it never touches `streak` or `played` (`useGameStore.ts`'s `submit()` guards on `isArchive`). For the daily: streak = consecutive daily wins, updated at the terminal submit (the moment the day's outcome is knowable), not on the next day's rollover. An opened-but-unplayed day is neither a win nor a loss and leaves no trace — only a day with at least one submitted guess can affect the streak.
6. **v3 playtest gate** (`docs/DIFFICULTY-2026-09-13.md` §3.1). Count-only feedback was gated on a 75-puzzle blind agent playtest (#600–674, five agents, 15 each) before promotion; the success bar was avg 3.0–3.5, ≥30% of puzzles needing 4+, losses under ~5% and concentrated on Fri/Sat, and qualitative notes saying "tricky" rather than "unfair". **Result (38 puzzles completed before the run was stopped; #600–669):** avg **4.05** guesses (a loss counted as 6), median 4, 66% needing 4+, 2 losses (5.3% — one Saturday, one Wednesday), distribution 1→6 of 2 · 5 · 6 · 7 · 12 · 6. Per weekday (n = 5–6): Mon 4.0 · Tue 3.4 · Wed 4.5 · Thu 4.4 · Fri 3.8 · Sat 5.0 · Sun 3.0. The gate **overshot** on average and 4+ share and sat at the edge on losses: the agents landed at the proposal's trait-*ignoring* bound (4.3) rather than its careful-human bound (2.9), where the same class of agent had sat 0.1 above the model under binary feedback. Two caveats: they played through the CLI with no ledger, which is exactly the aid the proposal said count feedback depends on, and no qualitative notes survived the stop. Decision (Oz, 2026-09-13): ship count-only and raise par to the smoothed medians rather than fall back to the ends-binary-plus-count variant; sanity-check with real play on the ledger UI before launch, and revisit par with a month of `played` data. Monday is the day to watch — three of five took five guesses against a hypothesised par of 2.
