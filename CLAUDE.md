# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Silbak is a Wordle-style daily deduction game: rank a troop of gorillas from silverback (most dominant) to omega (least) using field-note clues and visible traits, then after each guess learn how many apes stand on their true rung (a count, never which ones). Design spec lives in `docs/DESIGN.md` — read it before making any change to generation logic, feedback semantics, or visual tokens; it documents *why* things are the way they are, not just what they are, and should be kept in sync when those decisions change.

`docs/REVIEW-2026-09-13.md` is the current executive review and phased implementation plan (Part B). When asked to improve the game without a more specific brief, work its phases in order, and update its findings if the code has moved on since it was written. To run a fresh review (or re-check progress against that plan), use the `executive-review` skill (`.claude/skills/executive-review/SKILL.md`) — it encodes the three-lens workflow (browser play-through + blind playtest + code audits) and the report/plan format.

## Commands

All commands assume `pnpm` (workspace-aware; `packageManager` is pinned in root `package.json`). Root-level scripts fan out through Turborepo to every workspace package:

```bash
pnpm install              # from repo root, always
pnpm dev                  # starts apps/web's Vite dev server
pnpm build                # tsc + vite build across all packages
pnpm test                 # vitest run across all packages
pnpm typecheck             # tsc --noEmit across all packages
```

To work in one package only, `cd` into it first (`packages/engine` or `apps/web`) and run the same script names directly, or use `pnpm --filter @silbak/engine <script>` / `pnpm --filter @silbak/web <script>` from the root.

**Running a single test** (from `packages/engine/`):
```bash
npx vitest run test/invariants.test.ts          # one file
npx vitest run test/invariants.test.ts -t "some test name"   # one test by name
```

**Playtesting a puzzle without the browser** (from `packages/engine/`):
```bash
npx tsx scripts/playtest-cli.ts info <puzzleNumber>
npx tsx scripts/playtest-cli.ts guess <puzzleNumber> <id0,id1,...>
```
This is the harness for blind CLI-based playtesting (never prints the solution) — see the `playtest-puzzles` skill (`.claude/skills/playtest-puzzles/SKILL.md`) for the full large-scale-playtest workflow, including a known tsx-cache-contention stall pattern when running many agents against it in parallel and how to recover from it.

There is no dev server managed outside the Browser-pane tooling — `.claude/launch.json` defines the `silbak-web` config (`pnpm --filter @silbak/web dev` on port 5173, `autoPort` enabled; `vite.config.ts` honors a `PORT` env var so a second session can get a free port when 5173 is taken) that preview tooling uses to start it.

**The favicon is the portrait, not a copy of it:** `apps/web/public/favicon.svg` is one rung cropped to its `--rock` disc, with every path lifted verbatim from `ApeGlyph.tsx` in that file's 100x100 glyph space. Nothing enforces the correspondence, so re-crop it deliberately when the portrait geometry moves — see `docs/DESIGN.md` §6, "The mark". The committed PNG fallbacks are rasterised from it by `pnpm --filter @silbak/web icons` (Playwright, already a root devDependency); re-run that after editing the SVG.

That same command also renders `apps/web/public/og.png`, the 1200x630 link-preview card, via `scripts/render-og.mjs` — built from the real wordmark, the `tokens.css` palette (inlined as literals, since the page can't see the stylesheet) and `favicon.svg` itself, with the shipped font files embedded as data URIs so it can't silently rasterise in a fallback face. Re-run it after touching tokens, the favicon, or the wordmark treatment. The absolute URLs in `apps/web/index.html` (`og:url`, `og:image`, `canonical`) and `SITE_URL` in `apps/web/src/lib/share.ts` are the two places the domain is written down; they have to move together.

**Checking the ape portraits:** `/dev/apes` (mounted only under `import.meta.env.DEV`, route in `App.tsx`, page in `src/routes/DevApes.tsx`) renders every valid trait combination at 56px and 46px on the rung's `--rock` disc. It is the only test `ApeGlyph.tsx` has — eyeball the whole matrix after touching its trait tables or geometry.

## Architecture

### Monorepo shape

pnpm workspaces + Turborepo, two packages:
- `packages/engine` — the puzzle engine. Pure TypeScript, zero runtime dependencies, no DOM, no `Date.now()`. This is the keystone: it's the only place puzzle-generation logic exists, and it's designed to eventually be shared byte-identically between the web client and a server-side API (`apps/api` and `infra/` exist as empty placeholder directories from an earlier planning pass — not yet implemented, no code to find there).
- `apps/web` — Vite + React + TypeScript + Zustand + React Router.

### The generation pipeline (spans multiple files — read together, not in isolation)

`generate(dateKey)` in `packages/engine/src/index.ts` is pure and deterministic: same `dateKey` string always produces the same puzzle, forever, with no network or clock access beyond the date itself. The pipeline:

```
dateKey → hash(`silbak::v{ENGINE_VERSION}::{dateKey}`) → mulberry32 seed
  → buildTroop(rng)              [troop.ts]   → apes with gated random traits
  → computeTrueOrder(troop, rng) [troop.ts]   → true dominance ranking
  → candidateClues(order, troop) [clues.ts]   → every true clue about this ranking:
                                                 named clues + trait-quantified
                                                 clues over classes.ts's trait classes
  → selectClues(candidates, band)[select.ts]  → 2-4 clues that narrow the space
                                                 into that weekday's target range,
                                                 at least one of them relational
```

`ENGINE_VERSION` (in `version.ts`) is embedded in the seed — bumping it changes every puzzle for every date. It's currently 3 (bumped for count-only feedback, the trait-quantified clue family, and the weekend band rebuild — `docs/DIFFICULTY-2026-09-13.md`; 2 was the 5→6 ape change). Pre-launch, bumping it freely on generation-logic changes is fine; once there are live players, `docs/DESIGN.md`'s versioning note applies (never edit a shipped version's logic in place — add a new version behind a date cutover instead).

### Solution never leaves the engine boundary carelessly

`generate()` returns the solution alongside the puzzle. `stripSolution()` (also in `index.ts`) removes it. On the web side, `apps/web/src/lib/puzzle.ts` is the *only* file allowed to call `generate()` directly — everything downstream gets the stripped `Puzzle`. The Zustand store (`state/useGameStore.ts`) keeps the live solution in a module-level closure variable, never in store state, so no component can accidentally render it via a careless selector.

### Difficulty is tuned empirically, not derived

Three constants govern how hard a puzzle is, and none of them were arrived at analytically — they were swept and retuned against real generated output until measured behavior matched a target:
- `NOISE` (`troop.ts`) — how often the trait-obvious favorite is *not* actually the true silverback. Tuned so a "read the traits" guess is right roughly 55-65% of the time.
- `DOMINANCE_MARGIN` / `DOMINANCE_CAP` (`select.ts`) — excludes any candidate clue that would, on its own, nearly solve the puzzle; forces the generator to combine clues rather than lean on one strong one. The cap keeps `order`/`half` eligible at weekend ceilings, without which the weekend pool collapses to `neg`.
- `BANDS` (`select.ts`) — per-weekday target range for how many permutations survive the chosen clues.
- `PAR` (`select.ts`) — expected guesses per weekday, shown on the share line; set from the blind-playtest medians, not the solver.

If any of these change, re-run the relevant sweep rather than guessing at a new value — `packages/engine/test/model-tuning.test.ts` and `test/trickiness.test.ts` encode the target invariants, and `test/difficulty-simulation.test.ts` is a standalone (non-assertive) simulation harness for sweeping a constant across a range and observing guesses-to-solve. `select.ts`'s `BANDS` comment documents a real bug this surfaced: `DOMINANCE_MARGIN` creates hard edges in which clue kinds are eligible at a given ceiling, and a band placed entirely inside one of those edge zones can land on the *same* surviving-space value every single day even though the clues differ — bands must be checked against that lattice, not just against the invariant tests passing.

### Test files double as tuning tools, not just correctness gates

`determinism.test.ts` guards a golden snapshot (regenerate it deliberately — `rm -rf test/__snapshots__` — when a generation-logic change is intentional, never to silence an assertion you don't understand). `invariants.test.ts`, `model-tuning.test.ts`, and `trickiness.test.ts` assert the properties described above; `diversity.test.ts` asserts that no weekday collapses to a single space/kind-signature and that every puzzle carries a relational clue — the test that would have caught the v2 weekend bug. `difficulty-simulation.test.ts` prints tables via `console.log` and intentionally asserts nothing meaningful — it exists to be read, not to pass or fail. If you extend it, keep candidate guesses restricted to the remaining-consistent set rather than the full permutation universe; the full-universe search is what caused a real multi-minute stall once the troop size grew.

### Web app structure

Routes (`src/routes/`) are thin; state lives in one Zustand store (`useGameStore.ts`) covering the daily puzzle, archive puzzles, and in-progress guesses uniformly (archive play sets an `isArchive` flag rather than branching into separate state). `lib/storage.ts` handles the versioned localStorage envelope (streaks, played history, in-progress state) with the deliberate choice that any parse failure wipes and starts clean rather than throwing. Visual tokens (colors, type roles) live in `styles/tokens.css` and are treated as reserved in `docs/DESIGN.md` — `--banana` in particular is documented as meaning *only* "correct," never used for decoration or other buttons.
