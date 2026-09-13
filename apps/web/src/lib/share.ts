import { shareGrid } from "@silbak/engine";
import type { FeedbackSignal } from "@silbak/engine";

export function buildShareText(history: FeedbackSignal[][], solved: boolean, puzzleNumber: number): string {
  return shareGrid(history, solved, puzzleNumber);
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
