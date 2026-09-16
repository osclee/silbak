# Silbak — Production Readiness Pass

Date: 2026-09-16 · Reviewer: Claude · Owner: Oz
Reviewed at commit `6bfdab3` (master, PR #9 merged) · `ENGINE_VERSION = 3`

> **How to use this document.** This is a go-live checklist, not a game-design review — `docs/REVIEW-2026-09-13.md` covers that, and its Phases 1–4 have shipped. Everything here was verified against the code and the production build (`pnpm build`, served with `vite preview`, measured with Playwright at 375×812), not inferred from the docs. Findings are ordered by what would hurt most after launch. **P0** = the deployed site is broken or launch would lock in something you can't change later. **P1** = fix before telling people about it. **P2** = hygiene, fine to do in the first weeks. Each item has a concrete fix so it can be picked up as a task.

---

## Verdict

**The game is ready. The deployment and the launch plumbing are not.**

Verified working:

- `pnpm typecheck`, `pnpm test` (17 tests, 6 files) and `pnpm build` all pass on a clean `--frozen-lockfile` install with Node 22.
- `generate()` is fast and never throws: over the 400 days from today, median 6.1ms, p95 8.5ms, max 21ms, 0 errors. Nothing needs precomputing or caching.
- The solution boundary holds: only `apps/web/src/lib/puzzle.ts` calls `generate()`, the store keeps the solution in a closure, and no component can select it.
- Streaks, `played`, the day rollover in an open tab, the archive clamp (`/archive/<today>` → `/`, out-of-range → `/archive`), the duplicate-submit guard, the error boundary and the versioned localStorage envelope are all in place and behave as the v0.10 changelog describes.
- Date handling is consistent: every date is a local-calendar `YYYY-MM-DD` string, and every conversion from that string (puzzle number, weekday band, par) parses it as UTC midnight, so it can't drift across DST or timezones.
- The clue text, rules page and feedback wording all agree with engine v3.

What is not ready is everything *around* that: the deploy config never reaches Azure, the HTML head is stale, there is no way to know anyone is playing, and there is no mechanism for the one kind of change the design doc says you'll need to make after launch (a new engine version behind a date cutover).

---

## P0 — Broken in production or irreversible after launch

### 1. `staticwebapp.config.json` is never deployed

**What.** The workflow uploads `apps/web/dist` with `skip_app_build: true`. Vite only copies files from `apps/web/public/` into `dist`, and the config lives at `apps/web/staticwebapp.config.json`. Confirmed: the built `dist/` contains exactly `index.html` and `assets/`. Azure Static Web Apps reads the config from the uploaded folder, so it is running with **no config at all**.

**Effect on the live site.**
- No `navigationFallback` → a refresh on `/archive`, `/about` or `/archive/212`, or any shared deep link, is a hard Azure 404 page. Only `/` works.
- No `Cache-Control: no-cache` on `index.html` → after a deploy, a browser or CDN can keep serving the old `index.html`, which points at hashed asset filenames that no longer exist. That is the classic "the site is a blank page until I hard-refresh" incident, and it will happen on your second deploy.
- No CSP, no `X-Content-Type-Options`, no `Referrer-Policy`.

**Fix.** Move the file to `apps/web/public/staticwebapp.config.json` so Vite ships it at the `dist` root (the only change needed). Alternatively set `app_location: apps/web` and `output_location: dist` in the workflow. After the next deploy, verify with `curl -I https://<site>/archive/212` (expect 200 + `text/html`) and `curl -I https://<site>/index.html` (expect `cache-control: no-cache`).

While it's open, tidy the config (P2 #16 below) — but ship the move first, on its own.

### 2. There is no engine-version cutover, and the golden snapshot only covers 2026

**What.** `docs/DESIGN.md` and `CLAUDE.md` both say the rule after launch is *never edit a shipped version's logic — add a new version behind a date cutover*. Nothing implements that. `generate()` hashes a single constant `ENGINE_VERSION` into every seed, so the first post-launch tuning change (the docs already schedule one: revisiting `PAR` "with a month of `played` data", and NOISE's second target metric) forces either a global re-roll of every past puzzle — breaking every archive URL and every share line — or a retroactive refactor of the seed path under pressure. That is exactly the retroactive fix this pass exists to prevent.

The determinism guard has the same gap: `test/determinism.test.ts` snapshots `EPOCH` + 365 days, i.e. 2026-01-01 → 2026-12-31. From 2027-01-01, no test pins the puzzles players will get; a refactor that changes `rng.ts` or clue ordering would silently change every future daily.

**Fix (before launch, ~half a day).**
1. Add `engineVersionFor(dateKey)` in `version.ts`: a small sorted table of `{ from: dateKey, version }` cutovers, currently one entry `{ from: EPOCH, version: 3 }`. `generate()` uses it for the seed and for `puzzle.engineVersion`. Bumping in future = appending a row with a future date, never editing an old one. Same table gates `bandForDateKey`/`parForDateKey` if a version ever changes those.
2. Extend the golden snapshot to `EPOCH` + 1461 days (through 2029), and add a second, tiny "pinned puzzles" test: five hand-picked dates with their full `solution.order` written literally in the test file, so a snapshot regeneration can't quietly paper over a change.
3. Tag the launch commit (`v1.0.0`) so "the shipped v3 logic" has a concrete reference.

### 3. Mobile layout: six rungs and the submit button are never on screen together

**What.** Measured on the production build at 375×812 (an iPhone-class viewport): field notes start at y=314, the first rung at **y=488**, the last rung ends at 1046, and the submit button sits at **y=1062** on a 1568px page. Rungs are 82–95px tall. Every guess is: scroll down to swap, scroll further to submit, scroll back up to see the count land under the ladder. There are no responsive rules in any component stylesheet (the only `@media` queries are the canopy backdrop's). This is Phase 6 of the review plan, unshipped. Daily-puzzle traffic is overwhelmingly mobile, and this is the loop every player runs 3–5 times a day.

**Fix.** Exactly as REVIEW-2026-09-13 Phase 6: below ~480px, drop the 12ch rank column (badge over the portrait corner), force traits onto one line, shrink the header (title 2.75rem → 2rem, rules paragraph to one line or a disclosure), and cap rung height at ~72px. Target: first rung above y≈260 and submit visible on a fresh load at 375×812. Measure with `getBoundingClientRect`, not by eye — the Playwright script used for this pass is a 40-line starting point.

This is the one P0 that is purely reversible; it's here because it's the thing a first-day player will bounce off.

---

## P1 — Before you tell anyone

### 4. `index.html` head is stale and there is no link preview

Verified in the built `dist/index.html`: description says "Rank **five** apes"; `theme-color` is `#0D1913` (the retired dark palette — mobile browser chrome renders near-black over the cream page); no `<link rel="icon">` (the browser's `/favicon.ico` request 404s on every load — visible in the console); no `og:*`/`twitter:*` tags; no `apple-touch-icon`; no `manifest.webmanifest`; no `robots.txt`. A shared link renders as a bare URL. Fix per REVIEW Phase 5 step 4 — all of it lives in `index.html` and `apps/web/public/`, which P0 #1 creates anyway. Set `theme-color` to `--paper` (`#FBEFD3`). A 512px `--banana` glyph on `--card` is enough for the icon and the OG image.

### 5. Share text has no URL

`shareGrid()` emits the header and grid only. The share line is the entire growth loop of a daily game, and without a URL it's a puzzle nobody can find. Append the site URL as a final line in `apps/web/src/lib/share.ts` (web-side; the engine shouldn't know the domain), and record the decision in DESIGN.md §5, which currently says "Line 1 is the only text".

### 6. No analytics, no error reporting — and the tuning plan depends on data you won't have

There is nothing in the app that reports anything. Concretely that means: you won't know whether anyone played; a crash caught by `ErrorBoundary` goes to `console.error` and nowhere else; and the two post-launch tuning steps the design already commits to (revisit `PAR` after a month of real results, DESIGN.md §5; a second NOISE target metric, §9) need per-result data that only exists in each player's localStorage.

**Recommendation.** One cookieless, consent-free counter (Plausible, Umami or GoatCounter all qualify; none needs a banner) with a single custom event fired at the terminal submit: `{ weekday, guesses, solved, par }` — no puzzle content, no identifiers. That one event is the entire par-tuning dataset. Whatever you choose must be added to the CSP `script-src`/`connect-src` in the same change. If you'd rather ship with nothing, decide that explicitly and strike the "revisit par with real data" lines from `select.ts` and DESIGN.md so they don't read as a plan.

### 7. Dependency advisories: react-router

`pnpm audit --prod` reports three moderate advisories against `react-router-dom@6.30.4` / `react-router`: two open-redirect issues (one via a backslash in `<Link>`, one leading to XSS) and one arbitrary-constructor-injection. Real exposure here is low — the app never renders a user-supplied href and the only dynamic route param is integer-validated — but shipping known advisories on day one is a bad look and an easy fix. `react-router-dom@6.30.6` patches the XSS one; the other two are only patched in `react-router@7.18+`. Bump to 6.30.6 now (one line in `apps/web/package.json`, then `pnpm install`), and put the v7 migration on the post-launch list — it's mostly import renames for an app this size.

### 8. CI doesn't run on pull requests, and nothing protects `master`

The workflow triggers only on `push` to `master`. Every PR in the history merged without a check; the tests ran *after* the merge, on the same push that deploys. A failing test on `master` fails the deploy job, which is the right gate, but a PR author gets no signal until then. Add:

```yaml
on:
  push:
    branches: [master]
  pull_request:
  workflow_dispatch:
```

and make `build_and_deploy` conditional on `github.event_name != 'pull_request'`. Then enable branch protection on `master` requiring the "Typecheck and test" check. Both are five-minute changes.

### 9. The web app has zero tests, and every bug in the last review was in web logic

Streaks, rollover, the archive leak, the duplicate-submit bypass — all in `apps/web`, none covered. The engine has 17 tests; the web has a Vitest config nowhere and no `test` script (Turbo's `pnpm test` simply skips it). The persisted-state logic is now a live contract with players' streaks in it, which is exactly the kind of code that needs a regression net before its next change. Add `vitest` to `apps/web` with a `jsdom` environment and cover, in order:

1. `storage.ts`: `loadPersisted` on empty / v1 / v2 / garbage / missing-field payloads; `capPlayed`; `todayKey`/`yesterdayKey` across a DST boundary.
2. `useGameStore.ts`: `submit()` writes `played` and streak at the terminal guess only; `applyRollover` is a no-op for an already-recorded day, records a started-but-unfinished day, and leaves an unplayed day untouched; archive play touches neither.
3. `stats.ts`: `computeStats` month filtering and the `par` fallback for entries without one.
4. `ArchivePuzzle` validity: today, future, non-integer, huge.

### 10. A corrupted localStorage payload bricks the app with no way out

`loadPersisted()` accepts any object with `v === 2` as a `Persisted` without checking its shape. A payload with `v: 2` but no `streak` (a half-written entry after a crash, an extension, a bad future migration) makes `load()` throw on `persisted.streak.count`, the error boundary renders "Something went wrong — reload", and reload reproduces it forever because the boundary offers no reset. Two small fixes: validate the shape (`streak` object with numeric `count`/`max`, `played` object) and fall back to `emptyPersisted()` if anything is off — this is what the doc comment already claims happens; and give the error boundary a second button, "Reset saved data", that clears `silbak:*` keys and reloads.

Also decide and document the rollover rule for a *started* day: `applyRollover` records a day with ≥1 guess and no terminal submit as a loss (`solved: false`, guesses = submitted count) and resets the streak. That's a defensible choice, but DESIGN.md §9.5 only covers the *unplayed* case; write the started-but-unfinished case down before players start asking why their streak reset.

### 11. Persisted-format policy for after launch

`loadPersisted()` wipes on any unrecognised `v`. Pre-launch that was fine; post-launch a wipe is every player's streak gone. Write the rule down in `storage.ts` (and CLAUDE.md): `v` only ever increases, every bump ships a migration from the previous shape, and a wipe is never an acceptable migration. The v1 → v2 migration already in the file is the pattern; keep it as the template.

### 12. "Karisoke" and the puzzle number — two decisions that are free now and impossible later

- **Karisoke.** The eyebrow line reads "Karisoke observation log". Karisoke is the Dian Fossey Gorilla Fund's real research center. It's a real organisation's name on the first line of the game. Either get comfortable with that on purpose or swap it for a fictional station name before launch; the change is one string in `Board.tsx`.
- **Puzzle numbering.** Launch day is Troop **#259**. The number is derived from `EPOCH` (2026-01-01) and is *not* part of the seed — `generate()` hashes the date string — so renumbering is free right up until the first share line goes out, and then never again. Options: keep it (players get a 258-puzzle archive on day one, and the number is honest about the date), or set `EPOCH` to the launch date so the first public puzzle is #1 and the archive starts empty. Either is fine; pick one deliberately. If you keep the archive, note that every one of those 258 puzzles is *also* playable in the archive with no streak effect, which is a nice day-one hook.

---

## P2 — Hygiene, first weeks

13. **Fonts.** The build emits 50 font files (356KB) — Cyrillic, Greek, Vietnamese and Latin-ext subsets of five faces — because `global.css` imports the unqualified `@fontsource/<face>/<weight>.css`. Browsers only fetch subsets matching `unicode-range`, so the *player* downloads ~5 files; this is deploy weight and asset-list noise, not page weight. Switch to the `latin-<weight>.css` entries and the assets folder drops to 5 fonts.
14. **Nav has no active state** — `Link` instead of `NavLink`. One-line change plus a `.active` rule.
15. **DESIGN.md §6 Motion** still describes a submit-time rung flip ("rungs flip on X with an 80ms stagger"). No such keyframe exists — the only `@keyframes` in the web app are the canopy backdrop's. Either build it (REVIEW Phase 4 step 1) or rewrite the paragraph to describe what the count-verdict actually does.
16. **`staticwebapp.config.json` contents** (after P0 #1 moves it): remove the `/api/profile` route and `platform.apiRuntime` (no API exists); drop `webmanifest`/`png` from the fallback exclusions until P1 #4 adds those files; harden the CSP with `object-src 'none'; base-uri 'self'; frame-ancestors 'none'` and add `Permissions-Policy: camera=(), microphone=(), geolocation=()`. `style-src 'unsafe-inline'` has to stay — the canopy scene sets inline `style` attributes everywhere.
17. **Root `devDependencies`** `playwright` and `pngjs` are referenced by nothing in the repo (they were screenshot tooling from an earlier pass). Remove them; they cost CI install time on every run.
18. **`lint` is a stub** (`echo "no lint configured yet"`) that Turbo reports as passing. Add ESLint + Prettier with the React hooks plugin, or delete the script so nobody trusts it.
19. **Legacy `silbak:v1` migration** in `storage.ts` migrates a format no player ever received. Harmless; delete it after launch to keep the migration chain honest.
20. **`Board.tsx`** subscribes to the whole store (`useGameStore()` with no selector). Harmless at this size; switch to selectors before adding anything that updates on an interval.
21. **`apps/api/` and `infra/`** are mentioned in the README as empty placeholders but don't exist in the tree. Drop the sentence.

---

## Suggested launch sequence

| Step | Items | Effort | Reversible after launch? |
|---|---|---|---|
| 1 | P0 #1 (config to `public/`), P1 #7 (router bump), P1 #8 (CI on PRs + branch protection) | 1 hour | yes, but do first — everything else is verified through this pipeline |
| 2 | P1 #12 decisions (Karisoke, EPOCH), P0 #2 (cutover + snapshot + tag) | half a day | **no** — this is the irreversible set |
| 3 | P1 #4 (head + icons + previews), P1 #5 (share URL), P2 #16 (config hardening) | half a day | yes |
| 4 | P0 #3 (mobile layout) | half a day | yes |
| 5 | P1 #6 (analytics decision + one event), P1 #10/#11 (storage validation, reset button, format policy) | half a day | yes, but #6 gates the par retune |
| 6 | P1 #9 (web tests) | half a day | yes |
| — | Soft launch: share with a handful of people, watch step 5's event for a week | | |
| 7 | P2 list, then REVIEW-2026-09-13 Phase 4 (reveal ceremony, countdown) and the v7 router migration | ongoing | yes |

Steps 1–2 are the minimum before the URL goes anywhere public. Steps 3–4 are the minimum before you'd want a stranger to open it on a phone.

---

## Appendix — How the numbers were produced

- **Build inspection:** `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm build`, then `ls apps/web/dist` (only `index.html` + `assets/`; no `staticwebapp.config.json`) and `cat apps/web/dist/index.html` (stale description, dark `theme-color`, no icon/OG tags).
- **Engine timing:** `npx tsx` script calling `generate()` for 400 consecutive dates from 2026-09-16, `performance.now()` around each call; sorted, reported median/p95/max and the count of throws.
- **Mobile measurement:** `vite preview` on the production build, Playwright with the pre-installed Chromium at viewport 375×812, `getBoundingClientRect()` on the first/last rung buttons, the submit button and the field-notes section; `document.documentElement.scrollHeight` for page length; console errors captured (one: the favicon 404).
- **Advisories:** `pnpm audit --prod` at the reviewed commit.
- **Archive spot-check:** `/archive` renders 60 links, `/archive/<today>` redirects to `/` — matches the v0.10 clamp.
