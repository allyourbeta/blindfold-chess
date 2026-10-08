/**
 * Perfect-play and game-result scoring -- SPEC_buttons_results.md decisions.
 * The same logic as scripts/endgames/resultScore.mjs (used at build time);
 * this copy exists so the mapping can be unit-tested without a build-script
 * (node-only) test runner.
 */
const DRAW_CATEGORIES = new Set(["draw", "cursed-win", "blessed-loss"]);

/**
 * Tablebase category (from the side-to-move's own view) plus whose move it
 * is -> score from White's view, or null when the category isn't certain
 * ("maybe-*", "unknown", or anything else).
 */
export function categoryToScore(category: string | null | undefined, sideToMove: "w" | "b"): string | null {
  if (category === "win") return sideToMove === "w" ? "1-0" : "0-1";
  if (category === "loss") return sideToMove === "w" ? "0-1" : "1-0";
  if (DRAW_CATEGORIES.has(category ?? "")) return "1/2-1/2";
  return null;
}

/** A PGN `Result` header normalized to the catalog's score shape, or null for "*", missing, or malformed. */
export function normalizeGameResult(header: string | null | undefined): string | null {
  if (header === "1-0" || header === "0-1" || header === "1/2-1/2") return header;
  return null;
}

/** Swaps 1-0 and 0-1 (a draw is unchanged) -- for a flipped entry's game result. */
export function swapScore(score: string): string {
  if (score === "1-0") return "0-1";
  if (score === "0-1") return "1-0";
  return score;
}
