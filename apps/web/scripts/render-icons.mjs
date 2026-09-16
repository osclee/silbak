// Rasterises public/favicon.svg into the PNG fallbacks index.html links.
//
//   pnpm --filter @silbak/web icons
//
// favicon.svg is the source of truth and the only file to edit; these outputs exist
// because an SVG favicon is not universally honoured (Safari < 16.4) and because iOS
// home-screen icons must be PNG. Committed rather than built, so a static deploy needs
// no image toolchain — re-run this after touching the SVG.
//
// Chromium is the rasteriser because it is the renderer the icon actually has to
// survive, and because Playwright is already a dev dependency. CHROMIUM_PATH overrides
// the browser binary for environments that ship their own (CI images, sandboxes).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const svg = readFileSync(join(publicDir, "favicon.svg"), "utf8");

const targets = [
  // The tab-bar fallback. Keeps the mark's rounded corners, so the transparent
  // corner pixels have to survive: screenshot with omitBackground.
  { file: "favicon-32.png", size: 32, squared: false },
  // iOS masks home-screen icons itself and composites anything transparent onto
  // black, so this one is full-bleed with square corners.
  { file: "apple-touch-icon.png", size: 180, squared: true },
];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();

for (const { file, size, squared } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:transparent}
            svg{display:block;width:${size}px;height:${size}px}</style>
     ${svg}`,
  );
  if (squared) {
    await page.evaluate(() => document.querySelector("#field")?.setAttribute("rx", "0"));
  }
  await page.locator("svg").screenshot({ path: join(publicDir, file), omitBackground: true });
  console.log(`wrote public/${file} (${size}x${size})`);
}

await browser.close();
