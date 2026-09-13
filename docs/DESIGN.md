# Silbak — Design Specification

> A daily deduction game. Rank six apes in a gorilla troop from silverback to omega in six guesses.

Status: draft v0.5 · Owner: Oz · Last updated: 2026-08-17

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

**Turn.** Submit the current arrangement. Each of the six positions returns feedback:

| Signal | Meaning |
|---|---|
| `exact` | This ape belongs on this rung |
| `wrong` | This ape does not belong on this rung — no information about which way to move it |

Feedback is per-position and total — every rung always returns one of the two. There is no "no information" state.

**Limit.** Six guesses. Win on all-`exact`. Loss reveals the true order.

**Field notes.** Observations shown before the first guess, always true of the solution, never sufficient to determine it alone. Count varies more than in v0.1 (2–4 was the old range) since looser bands (§4) need more clues to narrow into.

### Feedback semantics — the precise rule

Let `truth[apeId]` be the ape's zero-indexed true position. For a guess placing ape `a` at index `i`:

```
truth[a] === i  → exact
truth[a] !== i  → wrong
```

### Why this changed from directional to binary feedback

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
candidateClues(order)   → ~62 clues, all true of the solution
  ↓
selectClues(band)       → 2–4 clues leaving |space| within the day's band,
                           no single clue dominant, and the set irreducible
  ↓
verify                  → brute-force all 720 permutations
```

Two hardening passes beyond the original spec, both in `select.ts`:

- **Dominance margin.** No chosen clue may, read alone, narrow to within a configurable multiple of the band ceiling — otherwise the generator happily picks one very strong clue and pads the rest with filler the player doesn't actually need. Current value: `DOMINANCE_MARGIN = 1.6` — the multiple must stay achievable against the ceiling, and `ceiling × margin` can never exceed the ~120-600 permutations any single clue could theoretically leave standing (weakest kind, `neg`, leaves 600 of 720; strongest, `count`/`between`, leaves 120). At ceilings ≥375 (Friday, Saturday) no clue kind clears the margin at all, and the search deliberately falls back to the full candidate pool — see the Difficulty bands note below.
- **Irreducibility.** No proper subset of the chosen clues may already reach band on its own — otherwise a 3rd/4th clue can ride along doing nothing. Checking single-clue removals is sufficient (removing a clue can only grow the surviving space, never shrink it), so this doesn't require enumerating all subsets.

### Clue types

Cut percentages are exact (not estimates) — each is a fixed function of troop size N=6, independent of which specific apes or clue instance: `order` and `between` only depend on relative order among 2-3 elements, so they're N-invariant; `adjacent`, `count`, `neg`, `half` scale with N.

| Kind | Form | Cuts |
|---|---|---|
| `order` | "X steps aside when Y approaches." (X ranks below Y) | 50% |
| `adjacent` | "X and Y — no one ranks in between." | 67% |
| `count` | "N of the troop groom below X." | 83% |
| `neg` | "X is not the silverback." / "X does not hold the lowest rung." | 17% |
| `half` | "X ranks in the top three." / "…bottom three." | 50% |
| `between` | "Y ranks somewhere between X and Z." | 83% |

Phrasing rule: **clarity beats flavor whenever flavor could change the parse.** "Feeds in the first wave" is atmospheric and ambiguous; "ranks in the top three" is not. Atmosphere lives in the verbs, never in the relation.

### Difficulty bands

The generator targets a *surviving solution space*, not a difficulty label. Fewer survivors = easier.

| Day | Band | avg space (sampled) | Feel |
|---|---|---|---|
| Mon | 16–44 | 33 | Nearly deducible |
| Sun | 24–60 | 49 | Soft landing |
| Tue | 72–135 | 117 | |
| Wed | 135–195 | 178 | |
| Thu | 195–224 | 204 | kept just under the 225 "neg-only pool" edge |
| Fri | 240–360 | 330 | spans 4 achievable lattice points (see note) |
| Sat | 360–504 | 490 | Deduction sets the frame, guessing does the work |

**A structural trap worth documenting, because it silently produced a real bug once:** `DOMINANCE_MARGIN` filters candidate clues by a *fixed* solo-survivor count per kind (order/half=360, adjacent=240, count/between=120, neg=600 — see the pipeline note above), which gives the eligible-clue pool hard edges at certain ceilings. In the zone `225 ≤ ceiling < 375`, only `neg` clues clear the margin, and stacking `neg`-only clues lands on a **sparse fixed lattice** of achievable spaces — {240, 288, 312, 336, 360, 384, 408, 480, 504} — not a continuum, because "not silverback"/"not lowest rung" on *k* apes is a clean inclusion-exclusion count. A naive proportional scale-up of the v0.2 bands put Friday's band entirely inside that zone at a single lattice point, and it landed on the identical `space=240` for **286 out of 286** sampled Fridays despite different troops and clues each day — real puzzles, zero actual variety. Fixed by widening Friday to straddle multiple lattice points (240–360). Any future band change that lands entirely inside `[225, 375)` should be checked against this lattice before shipping.

The clue engine has a hard structural ceiling around **space = 504** (`720 − 120 − 120 + 24`, two weak `neg` clues via inclusion-exclusion), driven by `MIN_CLUES = 2` and the weakest clue type — no combination of real clues can exceed that regardless of band settings. Saturday's ceiling sits exactly at it.

**Guesses-to-solve payoff** (Knuth-style optimal adaptive solver, real binary `grade()`, from `difficulty-simulation.test.ts`): average climbs from ~1.8 (space≈30, Monday-ish) to ~3.3–3.5 at the 480–504 ceiling, with the first-ever observed 5-guess optimal-play trials (~5% of runs at the top of the range) — genuinely more difficulty range than the 5-ape engine ever produced (avg maxed ~2.9, max ever 4, 0% needed 5+, up to its own 78-permutation ceiling). Still **100% solved within 6 guesses at every space size tested**, all the way to the 504 structural ceiling — no evidence a 7th guess is needed. A follow-up 75-puzzle agent playtest (non-optimal, attentive-human-style play) landed at avg 2.17 guesses, max 4, 0 losses — up from the 5-ape engine's own 75-puzzle playtest (avg 1.87, max 4 at 1.3% of puzzles vs 6-ape's 2.7%) — confirming the simulation's direction held under closer-to-real play, at a smaller (expected) magnitude than pure-optimal solving.

Selection is greedy over a shuffled clue pool: add a clue only if it strictly reduces the space and does not push it below the band floor; stop at the band ceiling or four clues, whichever comes first. Retry with a reshuffled pool up to 240 times (180 against a "no dominant clue" pool first, remainder against the full pool as fallback); if nothing lands in band and is irreducible, fall back to the best in-band-but-reducible result, then to the nearest miss.

**Invariants the generator must satisfy (assert in tests):**

- Every emitted clue is true of the true order.
- The true order is always a member of the surviving space.
- `2 ≤ clues.length ≤ 4`.
- `space ≥ 2` — never fully determined.
- No single clue dominant (dominance margin); clue set irreducible where the search budget allows.
- Identical output across Node, browser, and CI for the same seed.

---

## 5. Share format

```
Silbak #219  4/6
🪨🪨🍌🪨🪨
🍌🪨🪨🍌🪨
🍌🍌🪨🍌🍌
🍌🍌🍌🍌🍌
```

Rules, non-negotiable:

- **Banana and rock only.** This was originally framed as hiding directional arrows; now that feedback itself is non-directional, it's simpler: banana/rock is still the only spoiler-safe granularity (naming which apes were wrong would leak information).
- No ape names, no traits, no clue text.
- Loss renders `X/6` and shows all six rows.
- Line 1 is the only text. Puzzle number, not date — dates cause timezone arguments.
- Optional trailing streak line (`🔥 12`) once streaks exist. Off by default.

**Copy target:** `navigator.clipboard.writeText`, with `navigator.share` on mobile where available, falling back to a selectable textarea. Never fail silently — the button label is the receipt (`Copy result` → `Copied to clipboard`).

---

## 6. Visual system

The world is still a primatology field station in montane cloud forest, not a zoo — but as of v0.4 it's the station at midday, not at night. Reference material shifted from a dim observation log to the same log read in bright sun: same institutional voice, same typed field-note register, but with real color in it. The brief was explicitly "lighter and fun, Donkey Kong colors" — a warm sunlit clearing rather than a research tent, without giving up the field-journal identity.

### Tokens

```
--paper   #FBEFD3   page ground (warm banana-cream) + text/highlight on dark panels
--forest  #1C2E19   ink — primary text, glyph shadow/contour, crown darkening
--bark    #186B37   panels, rungs, glyph body fill — the "make the green lighter" token
--rock    #E3C08A   wood-tone: portrait frame background, inert/disabled, hover borders
--mist    #C9E0BC   secondary text on dark bark panels (rank, traits, "wrong rung" feedback)
--moss    #463A28   secondary text directly on the page ground (eyebrow, rules, nav links, notes)
--banana  #FFC93C   the single hot accent: correct rung, share glyph
--blood   #E14E2E   scar mark only (no longer "ranks lower" — feedback is non-directional as of v0.2)
```

`--sky` (`#7FA8C9`, formerly "ranks higher") was removed in v0.2 — it has no remaining use now that feedback is binary.

`--banana` is reserved. It marks correctness and nothing else — not buttons that aren't the primary action, not decoration, not hover states. (The focus ring used to borrow it; that stopped in v0.4 — see below.)

### Why there are two "secondary text" tokens now

`--forest` and `--paper` used to map directly onto "page ground" and "primary text" — one dark value, one light value, and everything else was built relative to those two. Going lighter broke that: the page ground had to become the light value and primary text the dark one, which is a straight swap and cost nothing. But `--mist` (the old secondary-text color) couldn't make the same trip. It's used in two structurally different places — as light-on-dark text inside bark panels (rung traits, field-note headers), and as muted text sitting directly on the page ground (the eyebrow line, nav links, rules copy). Those need opposite lightness once the page ground is light: a color dark enough to read on cream paper is, almost by construction, too dark to read against a green panel that's still deliberately mid-dark (see below), and vice versa. Rather than pick one and accept broken contrast in the other context, `--mist` stayed light (for bark panels) and `--moss` was added dark (for the page ground) — two tokens doing the one job "secondary text" used to do alone, split by which surface they sit on.

### Why the panel green didn't go all the way to pastel

The obvious reading of "lighter" is: make every green as light as the new cream page ground. That was tried and reverted, for two reasons that both trace back to `--banana` and the ape portraits:

- `--banana` (`#FFC93C`) is a light, warm yellow. Against a light or pastel panel it nearly disappears — the "correct rung" signal is the one piece of color that must never wash out. Against the current `--bark` (`#186B37`, deliberately kept mid-dark) it holds ~4.3:1, which is what makes a rung glow gold on submit instead of just faintly tinting.
- The ape portraits (§6, Portraits) are built from exactly three of these tokens by *value*, not by name: `--forest` has to be the darkest thing on the glyph (contours, far-limb shadow, crown patch), `--bark` the mid-value body fill, and `--paper` the lightest (eye dot, fur speckles, the full-silver mantle glow). If `--bark` drifts up too close to `--paper`, the eye dot and silvering — the whole point of the silvering trait — stop popping off the body. `--bark` at `#186B37` keeps that three-step ladder intact while still reading as a real, saturated jungle green rather than the old near-black (`#16251D` → `#186B37` is roughly a 14x jump in relative luminance — very much "lighter," just not pastel).

So the panel green got vivid, not pale. "Lighter" landed on the page ground (which has no such constraint) and on making every green in the palette a *real* green instead of a near-black one, rather than on flattening the whole app to one brightness band.

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

Ape portraits are **generated from traits**, never picked from a library:

- Build scales the torso and limbs (0.86 / 1.0 / 1.15 in depth)
- Silvering is a mantle over the back, as a gradient that fades into the body (0 → 0.55)
- Age drives sagittal crest height and muzzle length
- Scar draws a single diagonal stroke across the crown and cheek

The pose is the knuckle-walking quadruped profile of the **gorilla emoji** (U+1F98D), and the proportions in `ApeGlyph.tsx` are measured off it rather than eyeballed. Two of them are counter-intuitive enough to have been got wrong repeatedly, and are worth restating here because any future re-tune will hit them again:

- **The head is the highest point, not the shoulder hump.** The hump sits behind the crown and about a fifth of the body's height lower.
- **The torso is far wider than it is deep** (roughly 1.75:1). A torso that approaches circular reads as a bear regardless of what the head and limbs are doing.

Two other rules earn their keep. The head must overlap the chest deeply — any exposed neck reads as a canid instantly. And the body, head and near limbs are all filled in one value, with separation coming from thin `--forest` contours clipped to the area *outside* the torso; giving the torso its own lighter fill breaks the silhouette into a shell sitting on tubes, and stroking a limb's full outline (including the part buried in the chest) makes the limbs read as boots.

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
│  legend: ■ ○                │
├─────────────────────────────┤
│  ① [portrait] NAME       ○  │
│     prime · heavy · full    │
│  ② ...                      │
├─────────────────────────────┤
│  [ SUBMIT RANKING ]         │
│  4 guesses left   tap hint  │
├─────────────────────────────┤
│  ATTEMPTS (compact chips)   │
└─────────────────────────────┘
```

Result state replaces the submit block with headline + grid + copy button. The archive (`/archive/:number`) reuses the identical board with a date header and no streak effect.

---

## 8. Accessibility

- Rungs are `<button>` elements in DOM order; tab moves down the ladder, Enter selects/swaps.
- Feedback is never color-only — `■`, `○` glyphs accompany every state.
- Contrast (recomputed for the v0.4 palette): `--forest` on `--paper` (primary text on the page) is ~12.7:1; `--moss` on `--paper` (secondary text on the page) is ~9.7:1; `--paper` on `--bark` (name text on a rung) is ~5.75:1; `--mist` on `--bark` (secondary text on a rung) is ~4.65:1; `--banana` on `--bark` (the correct-rung glyph) is ~4.3:1. Verify any new pairing at 4.5:1 minimum — `--banana` on `--bark` is the one pairing that runs slightly under that on paper, tolerated only because the ■/○ glyph shape (next bullet) already carries the signal independent of color.
- `aria-live="polite"` region announces the result of each submission ("Rung 3 correct, four rungs wrong").
- Full keyboard play with no pointer.
- Target size ≥ 44px on every interactive element.

---

## 9. Open design questions

1. ~~Four clues may be one too many.~~ Superseded — clue count is now governed by the dominance-margin and irreducibility checks (§4) rather than a raw count cap; instrument guesses-to-solve distribution again after the v0.2 changes settle.
2. ~~Five apes vs six.~~ **Resolved in v0.3 — switched to six.** Prototyped as an isolated parallel engine (`packages/engine/src/proto6/` at the time), validated via simulation (avg guesses climbs to ~3.3-3.5 at the new ceiling vs 5-ape's ~2.9 max, first-ever 5-guess optimal-play trials) and a 75-puzzle agent playtest (avg 2.17 vs 5-ape's 1.87, 0 losses either way), then promoted to replace the 5-ape engine outright. The seventh-guess concern didn't materialize — 6 guesses stayed sufficient at every difficulty level tested, including the 504-permutation structural ceiling. One real caveat surfaced by the playtest, not resolvable by simulation: hand-tracking six traits felt like genuine bookkeeping overhead via a CLI harness; worth watching whether the real visual ladder UI keeps that feeling like reasoning rather than tedium.
3. **Should traits be hidden until guess two?** Would create a genuine opening decision but breaks the "learnable in one turn" pillar.
4. **Hard mode.** Candidate rule: any rung marked `exact` locks and cannot be swapped. Cheap to build, well-understood by the audience. Worth revisiting after v0.2's manual playtest results — if binary feedback alone plays well, hard mode may be unnecessary extra complexity; if it doesn't, hard mode is the next lever before touching ape count.
5. **Streak semantics.** Does the archive count toward streaks? Recommend no — archive is practice, dailies are the streak.
