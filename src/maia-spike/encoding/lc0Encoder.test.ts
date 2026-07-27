import { describe, expect, it } from "vitest";
import path from "node:path";
import { Chess } from "chess.js";
import * as ort from "onnxruntime-web";
import { encodeMove, decodeMove, NUM_POLICY_MOVES } from "./lc0Encoder";
import { mirrorFen, mirrorUci } from "./mirrorFen";
import { evaluatePosition } from "../inference/evaluatePosition";

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
