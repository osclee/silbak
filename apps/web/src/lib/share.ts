import { shareGrid } from "@silbak/engine";

/**
 * The canonical site URL, appended to every shared result.
 *
 * It lives here rather than in the engine's `shareGrid` on purpose: the engine
 * is deployment-agnostic (no DOM, no network, no clock) and knowing where it
 * happens to be hosted is exactly the kind of knowledge that would break that.
 * The engine owns the *score and the grid*; the web app owns the front door.
 *
 * Changing domains means changing this constant and the absolute URLs in
 * `apps/web/index.html` (og:url, og:image, canonical) — those are static
 * markup and can't import from here.
 */
export const SITE_URL = "https://silbak.io";

/**
 * A shared result with no link is a dead end — the grid is unmistakable once
 * you already play and meaningless if you don't, and a daily game grows almost
 * entirely by being pasted into group chats. The URL goes on its own trailing
 * line so the emoji grid stays a clean block above it, which is what most chat
 * clients will render as a preview.
 *
 * Spoiler-safety is unaffected: `shareGrid` still emits no names, no traits and
 * no ape order (see grade.ts).
 */
export function buildShareText(rows: boolean[][], solved: boolean, puzzleNumber: number, par: number): string {
  return `${shareGrid(rows, solved, puzzleNumber, par)}\n${SITE_URL}`;
}

export type ShareResult = "shared" | "copied" | "failed";

/**
 * navigator.share on mobile where available, otherwise clipboard. Never fails
 * silently — callers should show a selectable textarea when this is "failed".
 */
export async function shareOrCopy(text: string): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && "share" in navigator && isMobileViewport()) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      // Cancelled or unsupported payload — fall through to clipboard.
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
}
