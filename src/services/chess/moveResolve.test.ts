import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  normalizeMoveInput,
  resolveDescriptiveMove,
  resolvePartialMove,
  fuzzyMatchMove,
  resolveMoveInput,
} from "./moveResolve";

describe("normalizeMoveInput", () => {
  it.each([
    ["NF3", "Nf3"],
    ["e4", "e4"],
    ["BXE5", "Bxe5"],
    ["0-0", "O-O"],
    ["o-o-o", "O-O-O"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeMoveInput(input)).toBe(expected);
  });
});

describe("resolveMoveInput: standard SAN", () => {
  it("resolves a plain pawn move", () => {
    const chess = new Chess();
    const result = resolveMoveInput(chess, "e4");
    expect(result).toEqual({ ok: true, san: "e4" });
    expect(chess.fen()).toContain("w KQkq"); // untouched — resolver must not mutate
  });

  it("resolves a case-insensitive knight move", () => {
    const chess = new Chess();
    const result = resolveMoveInput(chess, "nf3");
    expect(result).toEqual({ ok: true, san: "Nf3" });
  });

  it("resolves castling", () => {
    const chess = new Chess(
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1",
    );
    expect(resolveMoveInput(chess, "0-0")).toEqual({ ok: true, san: "O-O" });
  });

  it("rejects an illegal move", () => {
    const chess = new Chess();
    const result = resolveMoveInput(chess, "e5");
    expect(result.ok).toBe(false);
  });
});

describe("resolveDescriptiveMove", () => {
  it("resolves when exactly one legal capture matches", () => {
    const chess = new Chess("8/8/4n3/8/2B5/8/8/K1k5 w - - 0 1");
    expect(resolveDescriptiveMove(chess, "bxn")).toBe("Bxe6");
  });

  it("returns null when more than one legal capture matches", () => {
    const chess = new Chess("8/8/8/3p4/1N3N2/8/8/K1k5 w - - 0 1");
    expect(resolveDescriptiveMove(chess, "nxp")).toBeNull();
  });

  it("resolveMoveInput surfaces the ambiguity as a rejection, not a guess", () => {
    const chess = new Chess("8/8/8/3p4/1N3N2/8/8/K1k5 w - - 0 1");
    const result = resolveMoveInput(chess, "NxP");
    expect(result.ok).toBe(false);
  });
});

describe("resolvePartialMove", () => {
  it("resolves a missing-rank pawn capture when unique", () => {
    const chess = new Chess("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2");
    expect(resolvePartialMove(chess, "exd")).toBe("exd5");
  });
});

describe("fuzzyMatchMove", () => {
  it("resolves UCI-style input", () => {
    const chess = new Chess();
    expect(fuzzyMatchMove(chess, "e2e4")).toBe("e4");
  });

  it("resolves a unique destination square buried in noise", () => {
    const chess = new Chess();
    expect(fuzzyMatchMove(chess, "umm e4 please")).toBe("e4");
  });
});
