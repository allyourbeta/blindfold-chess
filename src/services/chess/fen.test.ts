import { describe, it, expect } from "vitest";
import { fenToBoard, boardToFEN, sanitizeCastlingRights, validateFen, STARTING_FEN } from "./fen";

describe("fenToBoard / boardToFEN round-trip", () => {
  it("round-trips the standard starting position", () => {
    const board = fenToBoard(STARTING_FEN);
    expect(board[0].join("")).toBe("rnbqkbnr");
    expect(board[7].join("")).toBe("RNBQKBNR");
    expect(board[3][3]).toBeNull();
    const fen = boardToFEN(board, "w", "KQkq", "-", 0, 1);
    expect(fen).toBe(STARTING_FEN);
  });

  it("round-trips a sparse endgame position", () => {
    const fen = "8/8/8/4k3/8/8/4P3/4K3 w - - 3 40";
    const board = fenToBoard(fen);
    const roundTripped = boardToFEN(board, "w", "-", "-", 3, 40);
    expect(roundTripped).toBe(fen);
  });
});

describe("sanitizeCastlingRights", () => {
  it("keeps a right when king and rook are on their home squares", () => {
    const board = fenToBoard(STARTING_FEN);
    expect(sanitizeCastlingRights(board, "KQkq")).toBe("KQkq");
  });

  it("drops a right when the rook has moved off its home square", () => {
    const board = fenToBoard(STARTING_FEN);
    board[7][7] = null; // white kingside rook gone
    expect(sanitizeCastlingRights(board, "KQkq")).toBe("Qkq");
  });

  it("drops a right when the king isn't on its home square", () => {
    const board = fenToBoard(STARTING_FEN);
    board[7][4] = null;
    board[7][3] = "K";
    expect(sanitizeCastlingRights(board, "KQkq")).toBe("kq");
  });

  it("returns '-' when nothing is valid", () => {
    const board = fenToBoard("8/8/8/4k3/8/8/8/4K3 w - - 0 1");
    expect(sanitizeCastlingRights(board, "KQkq")).toBe("-");
  });
});

describe("validateFen", () => {
  it("accepts the standard starting position", () => {
    expect(() => validateFen(STARTING_FEN)).not.toThrow();
  });

  it("rejects a position with no black king", () => {
    expect(() => validateFen("rnbqbnr1/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toThrow();
  });

  it("rejects a position with two white kings", () => {
    expect(() => validateFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBKR w KQkq - 0 1")).toThrow();
  });

  it("rejects structurally malformed FEN", () => {
    expect(() => validateFen("not a fen")).toThrow();
  });
});
