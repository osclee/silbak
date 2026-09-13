# Silbak

A Wordle-style daily deduction game: rank a troop of six gorillas from silverback (most dominant) to omega (least dominant) using field-note clues and visible traits, then get per-position feedback after each guess. Same puzzle for everyone, once a day, six guesses, no account required.

The full design rationale — game rules, the dominance model, puzzle-generation contract, visual system, and accessibility requirements — lives in [`docs/DESIGN.md`](docs/DESIGN.md). Read it before touching generation logic, feedback semantics, or visual tokens.

## Monorepo shape

pnpm workspaces + Turborepo, two packages:

- **`packages/engine`** — the puzzle engine. Pure TypeScript, zero runtime dependencies, no DOM, no `Date.now()`. `generate(dateKey)` is deterministic: the same date always produces the same puzzle. This is the only place puzzle-generation logic exists.
- **`apps/web`** — the game itself: Vite + React + TypeScript + Zustand + React Router.

`apps/api` and `infra/` are empty placeholders from an earlier planning pass — nothing to find there yet.

## Getting started

Requires Node >= 20 and pnpm (the pinned version is in root `package.json`).

```bash
pnpm install
pnpm dev          # starts apps/web's Vite dev server
```

## Commands

Run from the repo root; Turborepo fans each script out to every workspace package:

```bash
pnpm dev          # Vite dev server (apps/web)
pnpm build        # tsc + vite build across all packages
pnpm test         # vitest run across all packages
pnpm typecheck    # tsc --noEmit across all packages
```

To work in one package only, `cd` into it (`packages/engine` or `apps/web`) and run the same script names, or use `pnpm --filter @silbak/engine <script>` / `pnpm --filter @silbak/web <script>` from the root.

### Running a single test

From `packages/engine/`:

```bash
npx vitest run test/invariants.test.ts
npx vitest run test/invariants.test.ts -t "some test name"
```

### Playtesting a puzzle without the browser

From `packages/engine/`:

```bash
npx tsx scripts/playtest-cli.ts info <puzzleNumber>
npx tsx scripts/playtest-cli.ts guess <puzzleNumber> <id0,id1,...>
```

This CLI never prints the solution — it's the harness for blind playtesting. See `.claude/skills/playtest-puzzles/SKILL.md` for the full large-scale playtest workflow.

## The generation pipeline

`generate(dateKey)` in `packages/engine/src/index.ts`:

```
dateKey → hash(`silbak::v{ENGINE_VERSION}::{dateKey}`) → mulberry32 seed
  → buildTroop(rng)              [troop.ts]   → apes with gated random traits
  → computeTrueOrder(troop, rng) [troop.ts]   → true dominance ranking
  → candidateClues(order, troop) [clues.ts]   → every true clue about this ranking
  → selectClues(candidates, band)[select.ts]  → 2-4 clues that narrow the space
                                                 into that weekday's target range
```

`generate()` returns the solution alongside the puzzle; `stripSolution()` removes it. On the web side, `apps/web/src/lib/puzzle.ts` is the only file allowed to call `generate()` directly.

Difficulty is governed by three constants tuned empirically against real generated output, not derived analytically: `NOISE` (`troop.ts`), `DOMINANCE_MARGIN` and `BANDS` (`select.ts`). See `docs/DESIGN.md` and the tests in `packages/engine/test/` (`model-tuning.test.ts`, `trickiness.test.ts`, `difficulty-simulation.test.ts`) before changing any of them.
