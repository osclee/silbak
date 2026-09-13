---
name: executive-review
description: Run an executive review of Silbak — what's working and what isn't across gameplay, rules clarity, UI/UX, engine tuning, and web-app correctness — by combining a hands-on browser play-through, a scaled-down blind playtest, and parallel code-audit subagents, then writing a dated docs/REVIEW-YYYY-MM-DD.md with tiered findings (what / why / fix) and a phased implementation plan Claude can follow later. Use whenever the user asks for an executive review, a health check, "what's working and what isn't", a state-of-the-app audit, a pre-launch review, or wants to re-assess the game after a batch of changes — even if they just say "review the app" or "how's silbak doing" without naming the pieces.
---

# Executive review of Silbak

This captures a workflow run once for real (2026-09-13, `docs/REVIEW-2026-09-13.md`) that produced 24 findings, six of them P0, across three lenses that each caught things the other two could not:

| Lens | What only it found |
|---|---|
| **Hands-on browser play-through** (you, in the Browser pane) | Feedback glyphs vanish on any swap; winning dims the ladder; mobile ladder is 1.7 screens; six identical submits accepted; `/archive/9999` serves a 2053 puzzle |
| **Blind playtest** (subagents via the CLI, never seeing the solution) | Glyph-only history forces a notepad past guess 2; all-`neg` clue sets "feel like guesswork"; a tester read `between` symmetrically |
| **Code audits** (subagents, read-only) | Saturday's `space` collapses to {480, 504}; `between` predicate is 2× stronger than its wording; streak never updated on the day it's earned; opening the app records a loss; 680KB of unused font subsets |

Run all three. Skipping one produces a review with a blind spot exactly the shape of that lens.

## Step 0: Orient before dispatching anything

1. Read `CLAUDE.md`, `docs/DESIGN.md` (all of it — the changelog at the top tells you what changed recently), every file in `packages/engine/src/`, and every file in `apps/web/src/`. This takes ~15 minutes and is not optional: the agent prompts below only work if you can tell them exactly which files and lines to look at, and you cannot judge their findings without your own model of the code.
2. Read the most recent `docs/REVIEW-*.md`. Its Part B is a phased plan; note which phases have shipped (check `git log` and the code, not just the doc). A re-review's first job is to say which prior findings are fixed, which regressed, and what's new — not to re-report the same list.
3. Baseline: from `packages/engine/`, run `npx vitest run` (expect all green; `difficulty-simulation.test.ts` takes ~40s and prints tables) and `npx tsx scripts/playtest-cli.ts info <n>` (expect JSON with no `solution` field). If either is broken, fix or report that first — everything downstream depends on them.
4. Pick fresh puzzle numbers for the playtest. `EPOCH` in `packages/engine/src/version.ts` is 2026-01-01; today's number is `puzzleNumber(todayKey())`. Prior runs used #400–429 (this workflow) and earlier ranges (see `playtest-puzzles`). Use a block ≥ 30 numbers past anything already played; 30 consecutive numbers covers each weekday ~4×.

## Step 1: Dispatch everything in one message

Send the playtest agents and both audit agents **in a single message, all in background mode**, then do Step 2 yourself while they run. Serial dispatch wastes the ~10 minutes each agent takes. Use Sonnet for all of them unless the user says otherwise — the work is well-specified and the cost difference is large.

### 1a. Blind playtest (3 agents × 10 puzzles)

Invoke the `playtest-puzzles` skill for the CLI contract and the agent prompt template, scaled to 30 puzzles across 3 agents (75/5 is the full-validation size; 30/3 is enough for a review and finishes in ~12 minutes). **Add two questions to the template** — they are where the review-grade signal came from:

```
Additionally, keep track of TWO specific things across all puzzles:
(a) Any clue whose English wording you found ambiguous or that you could read two
    ways (quote the clue verbatim and explain the two readings).
(b) How much "bookkeeping" you needed — did you have to keep a written table of which
    ape had been tried at which rung? Would a human without a notepad manage? Note
    that in the real UI the attempt history shows <describe what it currently shows>
    — assess whether that would have been enough for you.
```

Update the `<describe what it currently shows>` from your Step 0 reading — if Phase 1 of the 2026-09-13 plan has shipped, the history now shows arrangements and the question should ask whether *that* was enough. Also tell the agents the current rules-page trait summary verbatim, so their "trait heuristics" match what a real player is told.

Expect tsx cache contention when 5 agents share `packages/engine/` — the playtest skill's "resume, don't restart" note applies. In the 2026-09-13 run no agent stalled, but the prompt's "retry once after 60s" line is what prevented it.

### 1b. Engine audit agent (read-only)

Self-contained prompt. Must include: the repo path; the scratchpad path for throwaway scripts (with the note that scratch scripts import via absolute `C:/git/silbak/packages/engine/src/index`, not relative paths); "do NOT modify repo files"; "other agents run `npx tsx` in parallel — retry a hung call once". Then the questions. The ones that produced findings last time, which a re-review should re-ask *and extend*:

1. **Clue predicate vs. natural-English reading**, per kind in `clues.ts`. Quantify any mismatch as solo-survivor counts under each reading (the `between` strict/symmetric split was 120 vs 240 of 720).
2. **Per-weekday distribution over ≥730 days** of `space`, clue count, and clue-kind mix; how often each `selectClues` fallback path fires. Flag any weekday with < 4 distinct `space` values or a single clue kind (the Saturday lattice collapse). The reference script is in Appendix 1 of `docs/REVIEW-2026-09-13.md`.
3. **Trait-favorite accuracy** (`NOISE` claim in `troop.ts`), plus trait-least = omega, and the exact-rung distribution of a pure trait-sort first guess.
4. **Degenerate clue text** across ~730 puzzles: extreme `count` clues, one ape in ≥3 clues, sets that mention only one ape, anything that reads as a riddle. Real puzzle numbers as examples.
5. **Anything else**: determinism risks, timezone handling, DESIGN.md claims the code doesn't honor.

Ask for: numbered sections, one-line verdict each (CONFIRMED BUG / DESIGN SMELL / FINE), evidence with `file:line`, ≤1500 words.

### 1c. Web audit agent (read-only)

Same preamble ("do NOT start a dev server or open a browser — another reviewer is doing the visual pass"; may run `pnpm --filter @silbak/web typecheck` and `build`). Questions that produced findings:

1. **Streak/rollover/persistence** in `state/useGameStore.ts` + `lib/storage.ts`: trace by hand — win day 1/2/3 (what does the card show each day?); win, skip a day, win; open without playing then win; tab open across midnight; a real loss. Is the displayed streak ever correct for *today's* win?
2. **Archive route**: is today listed? Can today or a future number be played? Upper-bound validation? Crash on absurd numbers? Is `played` ever surfaced?
3. **Write-only persisted state** (grep each `Persisted` field).
4. **DESIGN.md §8 a11y claims vs. code**: live region per guess, `role` validity in `Ladder.tsx`, `Legend` `aria-hidden`, focus rings, 44px targets.
5. **Feedback visibility after a swap** (`Ladder.tsx` gate) and what `AttemptsHistory.tsx` actually renders.
6. **Share/copy path** and whether the share text carries a URL.
7. **Build/deploy hygiene**: workflow, `staticwebapp.config.json` SPA fallback, `index.html` meta (description accuracy, `theme-color` vs current palette, OG tags, favicon), committed build artifacts, bundle size and what dominates it.
8. **React/state anti-patterns**: whole-store subscriptions, error boundaries, magic-number duplication, mount-only date loads.

Same report format as 1b.

## Step 2: Your own browser pass (while agents run)

Start the app with the Browser pane (`preview_start` with `name: "silbak-web"`), never with Bash. Then, in order — this exact sequence found seven findings last time:

1. `localStorage.clear()` via `javascript_tool`, reload `/`. Screenshot the first paint at desktop. Note what a first-time player sees before scrolling: is the whole ladder visible? Is Submit?
2. Play today's puzzle honestly from the clues and traits. Use `find` to get rung refs (they're keyed by ape, so a ref follows its ape after a swap). Count how many taps a full rearrangement takes.
3. **Submit, then swap two rungs that were `wrong`.** Look at the rungs that were `exact`. (2026-09-13: their glyphs vanished — P0 #2.)
4. Win. Look at the ladder: is it celebrated or dimmed? What's on the result card — streak? stats? countdown? Click Copy: in the sandbox `navigator.clipboard` fails, so the textarea fallback *should* appear; read its value. Dump `localStorage.getItem('silbak:v1')` and check `streak`/`played` reflect the win you just made.
5. `resize_window` to `mobile`, reload. Measure — don't eyeball — with `javascript_tool`: first rung `top`, each rung's height, rank-column width, `scrollHeight` vs `innerHeight`, Submit button `top`. Reset to `desktop` when done.
6. `/about`: read it as a first-time player. Does it define every clue idiom the engine can emit? Every trait tier? Does it say what silverback/omega mean?
7. `/archive`: what's listed, is today there, are played puzzles marked, any developer strings leaking?
8. Force a loss on an archive puzzle (submit the initial arrangement six times — note whether duplicate submits are blocked). Read the loss card with `get_page_text`. Navigate away and back: is progress kept?
9. `/archive/<today>`, `/archive/9999`, `/archive/99999999999999` — what renders?
10. Keyboard-only: Tab to a rung, Enter, Tab, Enter — did it swap? Where is focus now? `document.querySelectorAll('[aria-live]')` during play — is anything announcing guesses?
11. `/dev/apes`: can you tell age, build, silvering, scar apart at 56px without reading labels? Say which read and which don't.

**Two Browser-pane traps, both hit last time:**
- After scrolling — especially under mobile emulation — screenshots can return a stale composited frame (a cream band where content should be) or time out. The DOM is the source of truth: `document.elementFromPoint(x, y)` and `getBoundingClientRect()` via `javascript_tool` tell you what is actually laid out. Do not report a screenshot artifact as an app bug, and do not spend more than two retries on a screenshot when a JS measurement answers the question.
- `zoom` is not supported in the pane; use `getBoundingClientRect` for sizes.

## Step 3: Verify headline claims yourself before reporting them

Any finding that will lead the report — especially engine numbers from an agent — gets re-run by you. Last time this was the weekday sweep (Appendix 1 of the 2026-09-13 review, ~1 minute). An agent's "Saturday collapses to two values" became a P0 only after the reviewer's own run showed `480|2|neg ×59 · 504|2|neg ×45`. If you can't reproduce it, it's a "reported by audit, unverified" note, not a finding.

Also sanity-check the playtest aggregate against calibration:

| Run | Puzzles | Avg | Median | Max | Losses | 1 / 2 / 3 / 4 |
|---|---|---|---|---|---|---|
| 6-ape baseline (playtest-puzzles) | 75 | 2.17 | 2 | 4 | 0 | — |
| Executive review 2026-09-13 (#400–429) | 30 | 2.27 | 2 | 4 | 0 | 5 / 16 / 5 / 4 |

Batch-to-batch variance at n=10 is large (2.0 / 2.1 / 2.7 within one run). Treat an average outside ~1.9–2.6, any loss, or >15% of puzzles at 4+ guesses as a signal to look closer, not as a conclusion.

## Step 4: Write the report

Deliver it in the conversation first (the user asked a question; answer it), then save it as `docs/REVIEW-YYYY-MM-DD.md` and update the pointer in `CLAUDE.md` to name the newest review. Structure that worked:

**Part A — Review**
1. Method (one paragraph — what was read, played, dispatched, and re-verified).
2. Verdict: two sentences, then "working well" and "not working" bullets. Lead with what's good; a review that's all defects is not credible and not useful.
3. Playtest table vs. calibration, plus the 3–4 qualitative themes that came back from *multiple* testers independently. One tester's opinion is a note; three testers' agreement is a finding.
4. Findings, tiered **P0** (fix before anyone else plays) / **P1** (the game around the puzzle) / **P2** (hygiene). Each: bold one-line title; *What* (file, mechanism, how it was verified); *Why it matters* (the player consequence, with tester quotes where they exist). Don't put fixes here — they go in Part B, so Part A stays true even after fixes ship.
5. Doc drift: every DESIGN.md claim the code doesn't honor, in one list. The design doc is this project's memory; keeping it honest is part of the review.

**Part B — Implementation plan**
- Phases in priority order, each independently shippable, each with: why it's in this position, numbered steps with files, verification steps (measurable, e.g. "first rung `top` < 260px at 375×812"), and **which DESIGN.md sections must change in the same commit**.
- Engine phases must spell out the version protocol: bump `ENGINE_VERSION`, `rm -rf packages/engine/test/__snapshots__`, regenerate deliberately; never touch `NOISE`/`DOMINANCE_MARGIN`/`BANDS` without a sweep and a follow-up playtest.
- Where you considered and rejected an alternative, say so in one sentence (e.g. "symmetric `between` predicate rejected — weakens the clue and reshuffles every band; reword instead"). That sentence is what stops the next Claude from re-litigating it.
- Close with an effort table and "the minimum before anyone outside the project plays."

**Appendices**: the reproduction script for the headline engine finding and its output; every other measured number with its sample size.

End the conversation reply with "if you do five things" — the five highest-leverage items — and offer to make the doc or a shareable page. Do not commit; the user decides.

## Scope variants

- **Quick check** (user says "quick", or it's a re-review a few days after fixes): skip the audit agents, run Steps 0, 2, 3 yourself, and a single 10-puzzle playtest agent focused on whatever changed. ~30 minutes.
- **Full** (default for "executive review"): everything above. ~45 minutes wall-clock, most of it waiting on agents — use it for Step 2.
- **Pre-launch**: full, plus ask the web agent for a security/privacy pass (CSP, localStorage contents, anything user-identifying) and ask the engine agent to confirm `ENGINE_VERSION` continuity rules in DESIGN.md §4 are followed.
