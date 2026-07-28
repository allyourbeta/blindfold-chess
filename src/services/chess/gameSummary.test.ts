import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  detectGameOver,
  describeGameEnd,
  formatMovePairs,
  formatHistorySummary,
  type StoredGame,
} from "./gameSummary";

describe("detectGameOver / describeGameEnd", () => {
  it("detects checkmate and reports the winner", () => {
    const chess = new Chess();
    for (const san of ["f3", "e5", "g4", "Qh4#"]) chess.move(san);
    expect(detectGameOver(chess)).toBe("checkmate");
    const outcome = describeGameEnd("checkmate", chess, "w");
    expect(outcome.text).toBe("Checkmate! Black wins.");
    expect(outcome.historyResult).toBe("Loss (checkmate)");
  });

  it("detects stalemate", () => {
    const chess = new Chess("k7/8/1Q6/8/8/8/8/6K1 b - - 0 1");
    expect(detectGameOver(chess)).toBe("stalemate");
  });
});

describe("formatMovePairs", () => {
  it("pairs white/black moves under move numbers", () => {
    expect(formatMovePairs(["e4", "e5", "Nf3"])).toBe("1. e4 e5  2. Nf3");
  });

  // Defect 4: a game set up from a FEN with Black to move on move 37 must
  // number and label from THAT move number and side to move, not as though
  // its first move were White's move 1.
  it("numbers from the starting FEN's move number and side to move, not from White's move 1", () => {
    const blackToMoveOn37 = "8/8/8/4k3/8/4K3/8/4R3 b - - 0 37";
    expect(formatMovePairs(["Kd5", "Rd1", "Ke4"], blackToMoveOn37)).toBe("37... Kd5  38. Rd1 Ke4");
  });

  it("still numbers from move 1 for a White-to-move custom setup", () => {
    const whiteToMoveOn12 = "8/8/8/4k3/8/4K3/8/4R3 w - - 0 12";
    expect(formatMovePairs(["Re1", "Kd5"], whiteToMoveOn12)).toBe("12. Re1 Kd5");
  });
});


describe("formatHistorySummary", () => {
  it("reports no games when history is empty", () => {
    expect(formatHistorySummary([])).toBe("No games played yet.");
  });

  it("summarizes recent games and totals", () => {
    const game: StoredGame = {
      date: "2026-01-01T00:00:00.000Z",
      result: "Win (checkmate)",
      color: "White",
      difficulty: "Club (~1500)",
      moves: 24,
      peeks: 2,
      pgn: "1. e4 e5",
      fen: "startpos",
      durationSec: 125,
    };
    const summary = formatHistorySummary([game]);
    expect(summary).toContain("1 games · 1 wins");
    expect(summary).toContain("2 peeks");
  });
});
