/**
 * Runs a loaded ONNX session against one FEN and returns a move distribution.
 * Shared by the worker (real inference) and the gate tests (same code path,
 * so a test failure here is a real failure, not a test-only reimplementation
 * drifting from what the app actually runs).
 */

import type { InferenceSession, Tensor as OrtTensor } from "onnxruntime-web";
import { Chess } from "chess.js";
import { boardToInputPlanes, encodeMove } from "../encoding/lc0Encoder";

export interface MoveProbability {
  uci: string;
  probability: number;
  index: number;
}

export interface EvaluationResult {
  moves: MoveProbability[]; // sorted, highest probability first
  /** (win, draw, loss) from the side-to-move's perspective. */
  wdl: [number, number, number];
  /** win - loss, in [-1, 1]. */
  value: number;
}

function toUci(move: { from: string; to: string; promotion?: string }): string {
  return move.promotion ? `${move.from}${move.to}${move.promotion}` : `${move.from}${move.to}`;
}

export async function evaluatePosition(
  session: InferenceSession,
  TensorCtor: typeof OrtTensor,
  fen: string,
): Promise<EvaluationResult> {
  const chess = new Chess(fen);
  const us = chess.turn() === "w" ? "w" : "b";

  const planes = boardToInputPlanes(fen);
  const inputName = session.inputNames[0];
  const input = new TensorCtor("float32", planes, [1, 112, 8, 8]);
  const outputs = await session.run({ [inputName]: input });

  const policyName = session.outputNames.find((n) => n.includes("policy")) ?? session.outputNames[0];
  const wdlName = session.outputNames.find((n) => n.includes("wdl")) ?? session.outputNames[1];
  const policy = outputs[policyName].data as Float32Array;
  const wdl = outputs[wdlName].data as Float32Array;

  const legalMoves = chess.moves({ verbose: true });
  const indices = legalMoves.map((m) => encodeMove(m.from, m.to, m.promotion, us));
  const logits = indices.map((i) => policy[i]);
  const maxLogit = Math.max(...logits);
  const expLogits = logits.map((l) => Math.exp(l - maxLogit));
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probabilities = expLogits.map((e) => e / sumExp);

  const moves: MoveProbability[] = legalMoves.map((m, i) => ({
    uci: toUci(m),
    probability: probabilities[i],
    index: indices[i],
  }));
  moves.sort((a, b) => b.probability - a.probability);

  const wdlTuple: [number, number, number] = [wdl[0], wdl[1], wdl[2]];
  const value = wdlTuple[0] - wdlTuple[2];

  return { moves, wdl: wdlTuple, value };
}
