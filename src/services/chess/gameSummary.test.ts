import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  detectGameOver,
  describeGameEnd,
  formatMovePairs,
  formatStatusLine,
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
});

describe("formatStatusLine", () => {
  it("shows the player's move when it's their turn", () => {
    expect(formatStatusLine(0, "w", "w")).toBe("Move 1 · White to play · Your move");
  });

  it("shows the engine is thinking on the opponent's turn", () => {
    expect(formatStatusLine(1, "b", "w")).toBe("Move 1 · Black to play · Engine thinking");
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
