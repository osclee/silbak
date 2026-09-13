import type { FeedbackSignal } from "@silbak/engine";

export function feedbackGlyph(f: FeedbackSignal): string {
  switch (f) {
    case "exact":
      return "■";
    case "wrong":
      return "○";
  }
}

export function feedbackLabel(f: FeedbackSignal): string {
  switch (f) {
    case "exact":
      return "Right rung.";
    case "wrong":
      return "Wrong rung.";
  }
}
