import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { generateMoveCandidates } from "./candidates";

function findVerbose(chess: Chess, san: string) {
  const move = chess.moves({ verbose: true }).find((m) => m.san === san);
  if (!move) throw new Error(`No legal move with SAN ${san} in ${chess.fen()}`);
  return move;
}

describe("generateMoveCandidates", () => {
  it("Nf3 includes the spec's minimum variant set", () => {
    const chess = new Chess();
    const candidates = generateMoveCandidates(findVerbose(chess, "Nf3"));
    expect(candidates).toEqual(
      expect.arrayContaining(["knight f3", "knight to f3", "knight f three", "n f3"]),
    );
  });

  it("Bxe5 includes the spec's minimum variant set", () => {
    const position = new Chess("4k3/8/8/4p3/8/2B5/8/4K3 w - - 0 1");
    const candidates = generateMoveCandidates(findVerbose(position, "Bxe5"));
    expect(candidates).toEqual(
      expect.arrayContaining(["bishop takes e5", "bishop x e5", "bishop captures e5"]),
    );
  });

  it("disambiguated moves include both spec-listed forms", () => {
    const chess = new Chess("4k3/8/8/8/8/8/8/1N3N1K w - - 0 1");
    const candidates = generateMoveCandidates(findVerbose(chess, "Nbd2"));
    expect(candidates).toEqual(expect.arrayContaining(["knight b d2", "knight from b to d2"]));
  });

  it("castling produces spoken forms for both sides", () => {
    const chess = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(generateMoveCandidates(findVerbose(chess, "O-O"))).toContain("castles kingside");
    expect(generateMoveCandidates(findVerbose(chess, "O-O-O"))).toContain("castles queenside");
  });

  it("promotion appends a promotes-to phrase", () => {
    const chess = new Chess("8/4P3/8/8/8/8/k7/4K3 w - - 0 1");
    const candidates = generateMoveCandidates(findVerbose(chess, "e8=Q"));
    expect(candidates.some((c) => c.includes("promotes to queen"))).toBe(true);
  });
});
