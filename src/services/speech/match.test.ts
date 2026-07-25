import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { matchTranscript, matchBestAlternative } from "./match";
import { normalizeTranscript } from "./normalize";

describe("matchTranscript: moves", () => {
  it("matches a close variant to the right legal move", () => {
    const chess = new Chess();
    const result = matchTranscript(chess, normalizeTranscript("night to f three"));
    expect(result.type).toBe("move");
    if (result.type === "move") expect(result.move.san).toBe("Nf3");
  });

  it("rejects gibberish with no close move", () => {
    const chess = new Chess();
    const result = matchTranscript(chess, normalizeTranscript("what a lovely day for chess"));
    expect(result.type).toBe("none");
  });

  it("does not guess when two distinct legal moves are equally close", () => {
    // Knights on b4 and f4 can both capture the pawn on d5 — "knight
    // captures d5" is an equally valid candidate for either move.
    const chess = new Chess("8/8/8/3p4/1N3N2/8/8/K1k5 w - - 0 1");
    const result = matchTranscript(chess, normalizeTranscript("knight captures d5"));
    expect(result.type).toBe("rejected");
    if (result.type === "rejected") expect(result.reason).toBe("ambiguous");
  });

  it("rejects a well-formed move that isn't legal instead of playing a near miss", () => {
    // The bug this guards: "knight d4" used to be played as the nearest legal
    // knight move rather than refused.
    const chess = new Chess("r1bqkbnr/pp1ppppp/2n5/8/8/2N5/PP1PPPPP/R1BQKBNR w KQkq - 0 5");
    const result = matchTranscript(chess, normalizeTranscript("knight d4"));
    expect(result.type).toBe("rejected");
    if (result.type === "rejected") {
      expect(result.reason).toBe("illegal");
      expect(result.label).toBe("Knight d4");
    }
  });

  it("still plays a legal move that sounds like the illegal one", () => {
    const chess = new Chess();
    const result = matchTranscript(chess, normalizeTranscript("knight c3"));
    expect(result.type).toBe("move");
    if (result.type === "move") expect(result.move.san).toBe("Nc3");
  });
});

describe("matchTranscript: commands", () => {
  it("matches a close command phrase", () => {
    const chess = new Chess();
    const result = matchTranscript(chess, normalizeTranscript("peek"));
    expect(result).toEqual({ type: "command", command: "peek", confidence: 1 });
  });

  it("never lets a move-shaped transcript resolve to a command", () => {
    const chess = new Chess();
    const result = matchTranscript(chess, normalizeTranscript("e4"));
    expect(result.type).not.toBe("command");
  });
});

describe("matchBestAlternative", () => {
  it("picks the best-scoring alternative across multiple recognition results", () => {
    const chess = new Chess();
    const result = matchBestAlternative(chess, ["gibberish nonsense", "knight to f3"]);
    expect(result.type).toBe("move");
    if (result.type === "move") expect(result.move.san).toBe("Nf3");
  });
});
