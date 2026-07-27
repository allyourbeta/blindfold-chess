import { describe, expect, it } from "vitest";
import path from "node:path";
import { Chess } from "chess.js";
import * as ort from "onnxruntime-web";
import { encodeMove, decodeMove, NUM_POLICY_MOVES, boardToInputPlanes } from "./lc0Encoder";
import { mirrorFen, mirrorUci } from "@/maia-spike/encoding/mirrorFen";
import { evaluatePosition } from "@/maia-spike/inference/evaluatePosition";

/**
 * Gate 1 (spec: "Policy-map round-trip") and Gate 2 (spec: "Colour-mirror
 * symmetry"). These confirm the port landed intact -- they do not, on their
 * own, prove the encoding is correct (see the spike report for that).
 */

const GATE_1_POSITIONS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", // startpos
  "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", // black to move, italian
  "8/P6k/8/8/8/8/8/K7 w - - 0 1", // white promotion (all 4 pieces)
  "k7/8/8/8/8/8/p6K/8 b - - 0 1", // black promotion (all 4 pieces)
  "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", // castling both sides
  "rnbqkbnr/ppp1pppp/8/8/2Pp4/8/PP1PPPPP/RNBQKBNR b KQkq c3 0 3", // en passant
];

describe("gate 1: policy round-trip", () => {
  it("maps every legal move to exactly one policy index with no collisions, and decodes back to the same move", () => {
    for (const fen of GATE_1_POSITIONS) {
      const chess = new Chess(fen);
      const us = chess.turn() === "w" ? "w" : "b";
      const legalMoves = chess.moves({ verbose: true });
      expect(legalMoves.length).toBeGreaterThan(0);

      const seenIndices = new Map<number, string>();
      for (const move of legalMoves) {
        const index = encodeMove(move.from, move.to, move.promotion, us);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(NUM_POLICY_MOVES);

        const moveKey = `${move.from}${move.to}${move.promotion ?? ""}`;
        const collision = seenIndices.get(index);
        expect(collision, `${moveKey} collides with ${collision} at index ${index} (fen: ${fen})`).toBeUndefined();
        seenIndices.set(index, moveKey);

        const decoded = decodeMove(index, us, (square) => chess.get(square as never)?.type === "p");
        expect(decoded.from, `fen: ${fen}, move: ${moveKey}`).toBe(move.from);
        expect(decoded.to, `fen: ${fen}, move: ${moveKey}`).toBe(move.to);
        expect(decoded.promotion, `fen: ${fen}, move: ${moveKey}`).toBe(move.promotion);
      }
    }
  });
});

/**
 * These three cases (real history feeds real distinct positions; oldest
 * known position being the startpos zero-fills the rest; more than 7 real
 * priors caps at 7 and drops anything older) were also cross-checked
 * end-to-end against `lczerolens`' independent `to_input_tensor` (an MIT,
 * lc0-bindings-tested implementation -- see CREDITS.md) for a set of real
 * SAN game sequences up to 17 plies deep, including castling, captures, and
 * promotions -- see SPEC_maia_integrate.md's report for that verification.
 * These are the hand-checkable structural facts that verification confirmed,
 * kept here as fast, dependency-free regression tests.
 */
describe("boardToInputPlanes: real prior history", () => {
  const KNIGHT_PLANE = 1; // "N" is index 1 in the white-first plane order "PNBRQK..."

  function planeOffset(slot: number, plane: number, square: number): number {
    return slot * 13 * 64 + plane * 64 + square;
  }

  it("slot 1 reflects the real prior position, not a repeat of the current one", () => {
    const current = "8/8/8/4N3/8/8/7k/4K3 w - - 0 1"; // knight e5
    const prior = "8/8/8/8/6N1/8/7k/4K3 w - - 0 1"; // knight g4 (one ply earlier)

    const tensor = boardToInputPlanes(current, [prior]);

    const e5 = 4 * 8 + 4; // rank 5 (index 4) * 8 + file e (4)
    const g4 = 3 * 8 + 6; // rank 4 (index 3) * 8 + file g (6)

    expect(tensor[planeOffset(0, KNIGHT_PLANE, e5)]).toBe(1); // slot 0: current position
    expect(tensor[planeOffset(0, KNIGHT_PLANE, g4)]).toBe(0);
    expect(tensor[planeOffset(1, KNIGHT_PLANE, g4)]).toBe(1); // slot 1: the real prior position
    expect(tensor[planeOffset(1, KNIGHT_PLANE, e5)]).toBe(0);
  });

  it("zero-fills any slot beyond the oldest known position when that position is the startpos", () => {
    const startpos = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

    const tensor = boardToInputPlanes(afterE4, [startpos]);

    // Slots 0 and 1 are known (current, then startpos); slots 2-7 must be
    // all zero -- lc0's fen_only rule once the oldest known position is
    // exactly the starting position.
    for (let slot = 2; slot < 8; slot++) {
      const slotBytes = tensor.slice(slot * 13 * 64, (slot + 1) * 13 * 64);
      expect(Array.from(slotBytes).every((v) => v === 0), `slot ${slot} should be all zero`).toBe(true);
    }
  });

  it("uses at most the 7 most recent prior positions, dropping anything older", () => {
    // 9 synthetic positions -- a lone white king on a1, b1, ..., h1, then
    // a2 -- none of them the startpos, one square apart so each is
    // trivially distinguishable from the others.
    const board = Array.from({ length: 8 }, () => Array<string>(8).fill("8"));
    board[0][7] = "k"; // black king on h8, purely so `current` is a valid FEN
    function fenWithWhiteKingAt(file: number, rank: number): string {
      const rows = board.map((row) => row.slice());
      rows[8 - rank][file] = "K";
      const boardField = rows
        .map((row) => {
          let out = "";
          let empties = 0;
          for (const cell of row) {
            if (cell === "8") {
              empties++;
            } else {
              if (empties) out += empties;
              empties = 0;
              out += cell;
            }
          }
          if (empties) out += empties;
          return out;
        })
        .join("/");
      return `${boardField} w - - 0 1`;
    }

    const squares = [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 1],
      [7, 1],
      [0, 2],
    ] as const;
    const fens = squares.map(([file, rank]) => fenWithWhiteKingAt(file, rank));
    const current = fens[8]; // a2
    const priors = fens.slice(0, 8); // a1..h1, oldest first -- 8 entries, one more than fits

    const tensor = boardToInputPlanes(current, priors);

    // Slot 1 (one ply back, i.e. the most recent prior) must be h1. a1 --
    // the oldest of the 8 given, one older than the 7-slot window holds --
    // must not appear in ANY slot: dropped, not zero-filled, since it isn't
    // the startpos.
    const kingPlane = 5; // "K" is index 5 in "PNBRQK..."
    const h1 = 0 * 8 + 7;
    const a1 = 0 * 8 + 0;
    expect(tensor[planeOffset(1, kingPlane, h1)]).toBe(1);
    for (let slot = 0; slot < 8; slot++) {
      expect(tensor[planeOffset(slot, kingPlane, a1)], `slot ${slot} should not show a1`).toBe(0);
    }
  });
});

const MODEL_PATH = path.join(process.cwd(), "public/maia/models/maia_kdd_1900.onnx");

describe("gate 2: colour-mirror symmetry", () => {
  it("gives the mirrored move distribution for a mirrored position, within tolerance", async () => {
    const session = await ort.InferenceSession.create(MODEL_PATH);
    try {
      const positions = [
        "4k3/8/8/8/3q4/8/3Q4/4K3 w - - 0 1", // free queen, white to move
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", // startpos
      ];

      for (const fen of positions) {
        const mirrored = mirrorFen(fen);
        const original = await evaluatePosition(session, ort.Tensor, fen);
        const mirroredResult = await evaluatePosition(session, ort.Tensor, mirrored);

        // Structural check: the mirrored position's best move must be the
        // mirror of the original's best move. This is robust to softmax
        // noise on secondary candidates and is exactly what a wrong plane
        // order or a wrong black-to-move transform would break.
        const originalBest = original.moves[0];
        const mirroredBest = mirroredResult.moves[0];
        expect(mirrorUci(originalBest.uci), `fen: ${fen}`).toBe(mirroredBest.uci);

        // Distributional check, generous tolerance: observed model-inherent
        // asymmetry (not an encoding bug -- see the spike report) is under
        // 0.02 for decisive positions and can reach ~0.15 for wide-open
        // ones with many similarly-weighted candidates, an artifact of
        // softmax amplifying small logit gaps. 0.08 comfortably covers the
        // positions tested here while still catching a gross mismatch.
        const mirroredByUci = new Map(mirroredResult.moves.map((m) => [m.uci, m.probability]));
        for (const move of original.moves) {
          const expectedUci = mirrorUci(move.uci);
          const mirroredProb = mirroredByUci.get(expectedUci);
          expect(mirroredProb, `fen: ${fen}, move ${move.uci} -> expected mirrored move ${expectedUci}`).toBeDefined();
          expect(
            Math.abs(move.probability - (mirroredProb as number)),
            `fen: ${fen}, move ${move.uci}: ${move.probability} vs mirrored ${mirroredProb}`,
          ).toBeLessThan(0.08);
        }
      }
    } finally {
      await session.release();
    }
  }, 30_000);
});
