// Rasterises the Open Graph / Twitter link-preview card into public/og.png.
//
//   pnpm --filter @silbak/web icons     (runs this and render-icons.mjs)
//
// Why this exists as a rendered PNG rather than a hand-drawn asset: a daily game
// grows almost entirely by being pasted into group chats, so the unfurled card is
// the front door for most people who ever see Silbak. That card should be the real
// wordmark in the real palette, not an approximation — so it is built from the same
// tokens (tokens.css), the same font files the app ships, and the same favicon.svg
// that is itself lifted from ApeGlyph. Nothing here is redrawn by eye.
//
// 1200x630 is the size every platform crops from. Facebook, Slack, iMessage and
// Twitter all letterbox or centre-crop around it; keeping the wordmark and tagline
// well inside the middle means no platform's crop can behead them.
//
// Re-run this after touching tokens.css, favicon.svg, or the wordmark treatment in
// Board.module.css. Committed rather than built, so a static deploy needs no image
// toolchain. CHROMIUM_PATH overrides the browser binary (CI images, sandboxes).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");

// The fonts are embedded as data URIs because the page is loaded via setContent
// with no server behind it — a relative @font-face src would 404 and the wordmark
// would silently rasterise in a system face, which is the one failure mode that
// looks fine in code review and wrong on every link anyone shares.
function fontDataUri(pkg, file) {
  const path = require.resolve(`${pkg}/files/${file}`);
  return `data:font/woff2;base64,${readFileSync(path).toString("base64")}`;
}

const display = fontDataUri(
  "@fontsource/ibm-plex-sans-condensed",
  "ibm-plex-sans-condensed-latin-700-normal.woff2",
);
const mono = fontDataUri("@fontsource/ibm-plex-mono", "ibm-plex-mono-latin-400-normal.woff2");

// The mark, inlined. Its own <svg> element carries width/height 64; the card sets
// its own size in CSS, and the 64x64 viewBox scales cleanly.
const mark = readFileSync(join(publicDir, "favicon.svg"), "utf8");

// Literals, not var() — this document cannot see tokens.css. Token name in the
// comment so a palette change is greppable from here. Kept in sync by hand with
// apps/web/src/styles/tokens.css.
const T = {
  paper: "#fbefd3", // --paper
  forest: "#1c2e19", // --forest
  banana: "#ffc93c", // --banana
  moss: "#463a28", // --moss
  bark: "#186b37", // --bark
  blood: "#8c2f1e", // --blood (the warm half of the relief split)
};

const html = `<!doctype html><meta charset="utf-8">
<style>
  @font-face {
    font-family: "Plex Condensed";
    src: url("${display}") format("woff2");
    font-weight: 700;
  }
  @font-face {
    font-family: "Plex Mono";
    src: url("${mono}") format("woff2");
    font-weight: 400;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px;
    height: 630px;
    background: ${T.paper};
    display: flex;
    align-items: center;
    gap: 64px;
    padding: 0 96px;
    overflow: hidden;
  }
  .copy { display: flex; flex-direction: column; gap: 22px; }
  /* The wordmark, with Board.module.css's relief split: --blood warm side,
     --bark cool side, because this sits on the --paper page ground. */
  .wordmark {
    font-family: "Plex Condensed", sans-serif;
    font-weight: 700;
    font-size: 148px;
    line-height: 0.92;
    letter-spacing: 0.01em;
    text-shadow: 3px 0 ${T.blood}, -3px 0 ${T.bark};
  }
  .sil { color: ${T.forest}; }
  .bak {
    color: ${T.banana};
    -webkit-text-stroke: 4px ${T.forest};
    paint-order: stroke fill;
  }
  .tagline {
    font-family: "Plex Condensed", sans-serif;
    font-weight: 700;
    font-size: 40px;
    line-height: 1.22;
    color: ${T.forest};
    max-width: 15ch;
  }
  .eyebrow {
    font-family: "Plex Mono", monospace;
    font-size: 21px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${T.moss};
  }
  /* The mark repeated as a short ladder — the card's one piece of game imagery,
     and the thing that makes the preview legible at thumbnail size where the
     tagline is already unreadable. Descending scale reads as rank. */
  /* favicon.svg carries its own width/height attributes (64), which beat a
     width set on the wrapping span — the svg has to be targeted directly or
     the whole ladder renders at thumbnail size inside correctly-sized boxes. */
  .ladder { display: flex; flex-direction: column; align-items: flex-end; gap: 14px; margin-left: auto; }
  .ladder svg { display: block; }
  .r1 svg { width: 212px; height: 212px; }
  .r2 svg { width: 178px; height: 178px; opacity: 0.88; }
  .r3 svg { width: 144px; height: 144px; opacity: 0.72; }
</style>
<div class="copy">
  <div class="eyebrow">Mikeno observation log</div>
  <div class="wordmark"><span class="sil">SIL</span><span class="bak">BAK</span></div>
  <div class="tagline">Rank the troop, silverback to omega.</div>
  <div class="eyebrow">One troop a day &middot; six guesses</div>
</div>
<div class="ladder">
  <span class="r1">${mark}</span>
  <span class="r2">${mark}</span>
  <span class="r3">${mark}</span>
</div>`;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
// The faces are embedded, so this resolves immediately — but waiting on it is what
// guarantees the screenshot is not taken mid-swap against the fallback face.
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(publicDir, "og.png") });
console.log("wrote public/og.png (1200x630)");

await browser.close();
