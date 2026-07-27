import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { reconstructStandardHistory } from "./historyReconstruct";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("reconstructStandardHistory", () => {
  it("returns an empty history for the very first move of a game", () => {
    expect(reconstructStandardHistory(STARTING_FEN, [])).toEqual([]);
  });

  it("reconstructs every real prior FEN for a standard game", () => {
    const chess = new Chess(STARTING_FEN);
    const sanMoves = ["e4", "e5", "Nf3", "Nc6"];
    const expectedFens: string[] = [];
    for (const san of sanMoves) {
      expectedFens.push(chess.fen());
      chess.move(san);
    }

    const result = reconstructStandardHistory(chess.fen(), sanMoves);
    expect(result).toEqual(expectedFens);
  });

  it("returns null for a custom-FEN game -- there's no way to know what came before it", () => {
    // A real position reached after one move from a non-standard setup.
    // Replaying "e5" from STARTING_FEN never reaches this fen, so this must
    // report "unknown", not silently guess at history that isn't there.
    const customFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    expect(reconstructStandardHistory(customFen, ["e5"])).toBeNull();
  });

  it("returns null if the given moveHistory doesn't actually produce the given fen", () => {
    expect(reconstructStandardHistory("8/8/8/8/8/8/8/k6K w - - 0 1", ["e4"])).toBeNull();
  });

  it("returns null if a SAN move in the history isn't even legal from the standard start", () => {
    expect(reconstructStandardHistory(STARTING_FEN, ["not-a-move"])).toBeNull();
  });
});
