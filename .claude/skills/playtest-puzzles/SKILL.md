---
name: playtest-puzzles
description: Playtest Silbak's puzzle-generation engine at scale by dispatching parallel subagents that play blind (via the headless CLI, never seeing the solution) like attentive humans, then aggregate their results into one report on guesses-to-solve and qualitative fun/difficulty. Use this whenever the user asks to playtest the puzzle engine, validate a difficulty or balance change (NOISE, bands, DOMINANCE_MARGIN, feedback semantics, troop size), sanity-check a new engine version or prototype before shipping it, or wants a "large-scale" or "multi-agent" playtest of the puzzles — even if they just say "playtest this," "run the puzzles through some tests," or "see how this feels" without naming agents or the CLI explicitly.
---

# Playtesting Silbak's puzzle engine

This captures a workflow that's been run twice for real, successful results: once validating the live 5-ape engine (75 puzzles, 5 agents, avg 1.87 guesses, 0 losses) and once validating a 6-ape prototype before it was promoted to replace the live game (75 puzzles, 5 agents, avg 2.17 guesses, 0 losses). Both runs surfaced things that pure simulation couldn't — genuine "aha" misdirection moments, a duplicate-trait bug, a clue-phrasing ambiguity, and a UX concern about bookkeeping load — which is the actual reason this is worth doing instead of only running the optimal-solver simulation in `packages/engine/test/difficulty-simulation.test.ts`. That simulation answers "is this winnable?" with a perfect logician. This answers "does this feel right?" with something closer to a careful human. Run both when you can; they're complementary, not substitutes.

## Why blind play through a CLI, not the browser or the source

Two constraints shape everything below:

1. **It has to be genuinely blind.** An agent that reads `grade.ts`, `troop.ts`, or `select.ts` to "check its work," or calls `generate()`/`grade()` directly instead of going through the CLI, isn't playtesting — it's grading its own homework with the answer key open. The value of this whole exercise is a signal about real difficulty, and that signal is worthless if it's contaminated.
2. **It has to parallelize cleanly.** Browser-based play shares one session's state across tabs, which doesn't scale to 5 independent agents. A stateless CLI that regenerates the puzzle fresh from a deterministic seed each call sidesteps that entirely — no state file, nothing to coordinate, nothing for one agent's actions to corrupt for another's.

Both constraints are why `packages/engine/scripts/playtest-cli.ts` exists. If a future engine change deletes or breaks it, rebuild it before playtesting — see "The CLI contract" below for exactly what it needs to do.

## The CLI contract

From `packages/engine/`, two commands:

```
npx tsx scripts/playtest-cli.ts info <puzzleNumber>
npx tsx scripts/playtest-cli.ts guess <puzzleNumber> <id0,id1,id2,...>
```

`info` prints the puzzle as JSON — troop (each ape's `id`, `name`, `age`, `build`, `silver`, `scar`), the field-note `clues`, and `space`. **It must never print the `solution` field.** `guess` takes a comma-separated permutation of ape ids (0-indexed, one of each, `TROOP_SIZE` of them — check `packages/engine/src/troop.ts`'s `TROOP_SIZE` export, since this has changed before and will likely change again) and prints real `grade()` feedback plus a `solved` boolean. Every invocation is a fresh process that regenerates the puzzle deterministically from the puzzle number — that's what makes statelessness free instead of an engineering problem.

If you need to rebuild this file, the essential shape is: import `generate` from `../src/index`, strip the `solution` field before printing for `info`, and for `guess` call the real `grade()` against the real (never-printed) solution. Validate guess length and uniqueness against `TROOP_SIZE`, not a hardcoded number — a past version of this file hardcoded `5` in three places and needed fixing when the troop size changed.

## Step 1: Decide scope

75 puzzles split across 5 agents (15 each) has worked well twice — big enough to see the difficulty distribution clearly, fast enough to finish in one sitting. Scale up or down if the user asks, but don't go much below ~10 puzzles per agent or the qualitative synthesis gets thin.

**Pick a fresh, non-overlapping puzzle number range per agent.** Reusing numbers you've already played (manually, or in an earlier test this session) contaminates the sample — you already know those answers. Check `EPOCH` in `packages/engine/src/version.ts` and pick a block of consecutive puzzle numbers each agent hasn't touched. Span enough calendar days that every weekday's difficulty band gets exercised — `bandForDateKey` in `select.ts` keys bands by day of week, so 75 consecutive days covers each weekday roughly 10-11 times, which is what both prior runs did.

## Step 2: The agent prompt

Each agent needs to be self-contained — it starts cold, with none of this conversation's context. Use this template, filling in the puzzle range and any context about *why* this playtest is happening (a specific tuning change, a new prototype, a regression check):

```
You're playtesting Silbak, a Wordle-style daily deduction game, in the monorepo at
<repo-path>. Players rank <TROOP_SIZE> apes from silverback (most dominant) to omega
(least) using field-note clues and per-ape traits (age, build, silvering, scar), then
get feedback after each guess.

## Why this playtest exists
<Explain the specific change or question being validated — e.g. "the feedback signal
just changed from directional to binary" or "this is a new N-ape prototype being
evaluated before promotion." Include any relevant baseline numbers from prior runs so
the agent has calibration, not just raw instructions.>

Play like an attentive, logical human — reason about clues and traits, don't try to be
a perfect minimax solver (a separate simulation already covers optimal play; this is
about how it actually feels).

## How to play — headless CLI, no browser needed
From `packages/engine/`, run:
    npx tsx scripts/playtest-cli.ts info <puzzleNumber>
Prints JSON: troop (ids/names/traits), clues, space. Never includes the solution.

To submit a guess:
    npx tsx scripts/playtest-cli.ts guess <puzzleNumber> <id0,id1,...>
<TROOP_SIZE> comma-separated ape ids in your guessed order (index 0 = silverback,
last index = omega). Prints real feedback and whether you solved it.

**Critical rule — do not cheat, even accidentally:** Only learn about a puzzle through
these two commands. Do NOT read packages/engine/src/grade.ts, troop.ts, or select.ts,
and do NOT call generate()/grade() directly. If tempted to "just check the solution to
save time," don't — record it as unsolved instead.

## Your assignment: puzzles #<START> through #<END> (<N> puzzles, in order)
For each puzzle: call info, reason through it, submit guesses, adjust from feedback,
stop at 6 guesses max (record "unsolved" rather than continuing past it). Record:
puzzle number, space, guesses used (or unsolved), and a 1-2 sentence note — fun,
boring, genuinely tricky, confusing, any trait misdirection, anything off about a
clue's wording.

## What to report back
1. Table: puzzle # | space | guesses (or unsolved) | note.
2. Aggregate stats: avg/median guesses among solved puzzles, unsolved count/rate,
   min, max.
3. A 4-6 sentence qualitative synthesis: what worked, what was boring, genuinely
   great "aha" moments, anything that felt unfair or confusing rather than hard,
   and your gut read on whether the difficulty feels right.

Keep the report tight — table, stats, synthesis — not a blow-by-blow of every guess.
```

## Step 3: Dispatch in parallel

Send all N agent calls **in one message** — separate messages serialize them, which defeats the purpose. Use background mode; there's nothing else productive to do while they run, and you'll get a notification per agent as each finishes.

## Step 4: When an agent stalls — resume, don't restart

This happened to 4 of 5 agents in the 6-ape run, all the same way: a "stalled: no progress for 600s" notification, usually right after the agent reported solving one puzzle successfully. The cause is file-lock/cache contention — 5 agents all invoking `npx tsx` from the same directory at the same moment race on tsx's on-disk cache. It is not a puzzle problem, and it's not a sign the agent's reasoning broke.

**Fix: resume the specific failed agent via `SendMessage` to its agent ID, don't dispatch a fresh one.** Tell it what it already completed (so it doesn't redo work or lose that data) and to continue from the next puzzle in its range, noting that a hang on any individual CLI call is probably transient contention worth one retry before assuming something's actually broken. Expect to do this for most or all of a 5-agent batch when it happens — it's a batch-wide contention pattern, not an isolated fluke, so don't be surprised if you're resuming 3-4 agents in a row.

## Step 5: Aggregate

Once every agent reports back:

1. Combine every agent's table into one master list (or keep per-batch tables plus a combined summary — either works).
2. Compute overall stats across the full sample: average and median guesses, min/max, unsolved rate, and the guess-count distribution (what % solved in 1, 2, 3... guesses) — the distribution matters as much as the average, since two runs with the same average can feel completely different (all 2s vs. a mix of 1s and 3s).
3. If there's a prior playtest to compare against (before/after a tuning change, or a baseline engine vs. a prototype), present a direct side-by-side table — this is usually the most useful single artifact for the user.
4. Synthesize the qualitative notes across all agents into a few sentences: recurring themes (trait misdirection landing well, specific clue types producing real "aha" moments), anything flagged as confusing or unfair rather than hard (these are bugs, not difficulty — take them seriously), and an overall verdict.

## Calibration reference: known-good results

Use these to judge whether a new run's numbers look normal or like something regressed:

| Engine | Puzzles | Avg guesses | Median | Max | Losses |
|---|---|---|---|---|---|
| 5-ape, binary feedback | 75 | 1.87 | 2 | 4 (1.3%) | 0 |
| 6-ape, binary feedback | 75 | 2.17 | 2 | 4 (2.7%) | 0 |

Zero losses in both. If a new run shows meaningfully higher losses or a much higher average, that's worth investigating before trusting the rest of the report — either a real difficulty regression or something wrong with how the agents played (e.g. accidentally not blind).
