import { describe, it, expect } from "vitest";
import { extractFromRecipe } from "../../../scripts/endgames/extract.mjs";

// SPEC_endgames_handpicked.md Part 1: the `fen` extract kind for hand-picked
// positions -- a literal placement, validated with chess.js, never fetched.
describe("extractFromRecipe, kind: fen", () => {
  it("round-trips a legal FEN's placement and side to move", async () => {
    const result = await extractFromRecipe({ kind: "fen", placement: "4k3/8/8/8/8/8/8/4K3", sideToMove: "w" });
    expect(result.placement).toBe("4k3/8/8/8/8/8/8/4K3");
    expect(result.sideToMove).toBe("w");
  });

  it("throws on an illegal FEN (no kings)", async () => {
    await expect(extractFromRecipe({ kind: "fen", placement: "8/8/8/8/8/8/8/8", sideToMove: "w" })).rejects.toThrow();
  });
});
