import type { Silver } from "@silbak/engine";

/** "none" reads oddly as a trait — "no silver" and "full silver" scan better inline. */
export function formatSilver(silver: Silver): string {
  if (silver === "none") return "no silver";
  if (silver === "full") return "full silver";
  return silver;
}
