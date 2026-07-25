import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { movePhraseParts } from "./san";

function findVerbose(chess: Chess, san: string) {
  const move = chess.moves({ verbose: true }).find((m) => m.san === san);
  if (!move) throw new Error(`No legal move with SAN ${san} in ${chess.fen()}`);
  return move;
}

describe("movePhraseParts", () => {
  it("quiet pawn move", () => {
    const chess = new Chess();
    expect(movePhraseParts(findVerbose(chess, "e4"))).toEqual(["pawn", "to", "e", "4"]);
  });

  it("pawn capture", () => {
    const chess = new Chess("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2");
    expect(movePhraseParts(findVerbose(chess, "exd5"))).toEqual(["pawn", "e", "takes", "d", "5"]);
  });

  it("castles kingside", () => {
    const chess = new Chess("r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1");
    expect(movePhraseParts(findVerbose(chess, "O-O"))).toEqual(["castles-kingside"]);
  });

  it("castles queenside", () => {
    const chess = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(movePhraseParts(findVerbose(chess, "O-O-O"))).toEqual(["castles-queenside"]);
  });

  it("promotion", () => {
    const chess = new Chess("8/4P3/8/8/8/8/k7/4K3 w - - 0 1");
    expect(movePhraseParts(findVerbose(chess, "e8=Q"))).toEqual([
      "pawn",
      "to",
      "e",
      "8",
      "promotes-to",
      "queen",
    ]);
  });

  it("disambiguated move", () => {
    const chess = new Chess("4k3/8/8/8/8/8/8/1N3N1K w - - 0 1");
    expect(movePhraseParts(findVerbose(chess, "Nbd2"))).toEqual([
      "knight",
      "from",
      "b",
      "to",
      "d",
      "2",
    ]);
  });

  it("check", () => {
    const chess = new Chess();
    chess.move("e4");
    chess.move("d5");
    expect(movePhraseParts(findVerbose(chess, "Bb5+"))).toEqual(["bishop", "to", "b", "5", "check"]);
  });

  it("checkmate", () => {
    const chess = new Chess();
    chess.move("f3");
    chess.move("e5");
    chess.move("g4");
    const mateMove = findVerbose(chess, "Qh4#");
    expect(movePhraseParts(mateMove)).toEqual(["queen", "to", "h", "4", "checkmate"]);
    chess.move(mateMove.san);
    expect(chess.isCheckmate()).toBe(true);
  });
});
