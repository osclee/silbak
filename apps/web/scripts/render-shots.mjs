// Renders the before/after comparison plates in docs/screenshots/<tag>/.
//
//   BASE_URL=http://127.0.0.1:4174 NEW_URL=http://127.0.0.1:4173 \
//     OUT=../../docs/screenshots/v0.14-launch node scripts/render-shots.mjs
//
// Both URLs must already be serving a built app — the point is to photograph two
// real builds, not to mock a difference. The usual way to get them is a worktree
// at the base commit, `pnpm build` in each, and `vite preview` on two ports.
//
// Composition follows docs/screenshots/v0.13-relief: a near-black plate, BEFORE
// in --mist and AFTER in --banana, cropped to the thing that actually changed.
// Tall phone captures are laid out side by side and wide strips stacked, because
// a 664px-tall pair stacked is unreadable in a PR diff.
//
// The plates are composed in the browser rather than with an image library: each
// capture goes back into a second page as a data URI and that page is screenshot.
// Same trick as render-og.mjs, and it means no dependency beyond Playwright.
import { chromium, devices } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4174";
const NEW_URL = process.env.NEW_URL ?? "http://127.0.0.1:4173";
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", process.env.OUT ?? "../../docs/screenshots/v0.14-launch");
mkdirSync(outDir, { recursive: true });

// Literals — this page cannot see tokens.css. Kept in sync by hand.
const T = { plate: "#1a1a1a", mist: "#c9e0bc", banana: "#ffc93c" };

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

/** Screenshot one target off one build, returning a PNG buffer. */
async function capture(url, { viewport, path = "/", fullPage = false, selector, before }) {
  const ctx = await browser.newContext(viewport);
  const page = await ctx.newPage();
  await page.goto(url + path, { waitUntil: "networkidle" });
  // The canopy backdrop animates forever, so there is no network-idle moment that
  // also means "settled"; a beat after load is what keeps two captures comparable.
  await page.waitForTimeout(700);
  if (before) await before(page);
  const shot = selector
    ? await page.locator(selector).first().screenshot()
    : await page.screenshot({ fullPage });
  await ctx.close();
  return shot;
}

/**
 * Lay two captures out on a labelled plate and write it to disk.
 *
 * The scale bookkeeping matters. Captures come off a DPR-2 context, so a 390px
 * phone arrives 780px wide; the plate is *also* screenshot at DPR 2. Left alone
 * that compounds to 4x, which makes a 13px label look like 3px beside the app
 * and turns a full-page phone capture into a six-megabyte file. So each image is
 * laid out at `naturalWidth / 2` CSS pixels — its true size — and the plate's own
 * DPR 2 then hands the capture's full resolution back. `scale` shrinks from there
 * when a plate would otherwise be too tall to read in a diff.
 */
async function plate(file, beforeBuf, afterBuf, { direction, caption, scale = 1 }) {
  const row = direction === "row";
  const css = row
    ? ".pair{display:flex;gap:26px;align-items:flex-start}"
    : ".pair{display:flex;flex-direction:column;gap:20px}";
  const html = `<!doctype html><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:${T.plate};padding:26px;display:inline-block;
       font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  ${css}
  .col{display:flex;flex-direction:column;gap:8px}
  .label{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
  .before .label{color:${T.mist}}
  .after .label{color:${T.banana}}
  img{display:block}
  /* Narrow enough that the caption never drives the plate wider than the thing
     being photographed — a 980px line beside a 350px rung is all dead plate. */
  .caption{color:${T.mist};font-size:11.5px;line-height:1.5;letter-spacing:.03em;
           margin-top:18px;opacity:.8;max-width:560px}
</style>
<div class="pair">
  <div class="col before"><span class="label">Before</span>
    <img src="data:image/png;base64,${beforeBuf.toString("base64")}"></div>
  <div class="col after"><span class="label">After</span>
    <img src="data:image/png;base64,${afterBuf.toString("base64")}"></div>
</div>
${caption ? `<div class="caption">${caption}</div>` : ""}`;

  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.setContent(html);
  await page.evaluate(async (s) => {
    const imgs = [...document.querySelectorAll("img")];
    await Promise.all(imgs.map((i) => (i.complete ? null : i.decode().catch(() => {}))));
    for (const img of imgs) img.style.width = `${(img.naturalWidth / 2) * s}px`;
  }, scale);
  await page.waitForTimeout(150);
  const buf = await page.locator("body").screenshot();
  writeFileSync(join(outDir, file), buf);
  await ctx.close();
  console.log(`wrote ${file}`);
}

const phone = { ...devices["iPhone 12"] };
const phoneWide = { viewport: { width: 390, height: 664 }, deviceScaleFactor: 2 };

// 1. The fold. The headline claim of the change: what a player sees before
//    scrolling at all. Viewport-sized on purpose — a fullPage capture is exactly
//    the framing that hid this problem.
await plate(
  "mobile-fold.png",
  await capture(BASE_URL, { viewport: phone }),
  await capture(NEW_URL, { viewport: phone }),
  {
    direction: "row",
    scale: 0.8,
    caption:
      "390x664, first screen, no scrolling. Before: the ladder starts at y=471 and Submit sits at y=1052.",
  },
);

// 2. The whole board. Where the uniform rung heights and the recovered vertical
//    budget actually read.
await plate(
  "mobile-board.png",
  await capture(BASE_URL, { viewport: phone, fullPage: true }),
  await capture(NEW_URL, { viewport: phone, fullPage: true }),
  {
    direction: "row",
    scale: 0.46,
    caption:
      "Full page at 390px. Rungs go from 82-95px and ragged to a uniform 62px; the page from 2.45 screens to 2.15.",
  },
);

// 3. One rung, close up — the 12ch rank column and the wrapped trait line are the
//    mechanism behind everything in plates 1 and 2.
const rungSel = 'button[class*="rung"]';
await plate(
  "rung.png",
  await capture(BASE_URL, { viewport: phoneWide, selector: rungSel }),
  await capture(NEW_URL, { viewport: phoneWide, selector: rungSel }),
  {
    direction: "column",
    caption:
      'At 390px the 12ch rank column spent a quarter of the viewport on "SILVERBACK" and wrapped the traits; the numeral badge buys the trait line one row.',
  },
);

// 4. The hint row — two strings, no gap, both wrapping into each other.
await plate(
  "hint-row.png",
  await capture(BASE_URL, { viewport: phoneWide, selector: '[class*="hintRow"]' }),
  await capture(NEW_URL, { viewport: phoneWide, selector: '[class*="hintRow"]' }),
  {
    direction: "column",
    caption:
      '`justify-content: space-between` with no gap, at 390px: two sensible strings rendering as one garbled sentence.',
  },
);

// 5. The archive, which the epoch backdate is for.
await plate(
  "archive.png",
  await capture(BASE_URL, { viewport: phone, path: "/archive", fullPage: true }),
  await capture(NEW_URL, { viewport: phone, path: "/archive", fullPage: true }),
  {
    direction: "row",
    scale: 0.46,
    caption: "EPOCH on launch day left the archive empty; backdated fourteen days it opens stocked.",
  },
);

await browser.close();
