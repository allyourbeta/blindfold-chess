/// <reference lib="webworker" />
/**
 * The Maia inference worker for actual play. This is the GPL isolation
 * boundary for the game (see CREDITS.md): the only place outside the spike
 * that imports the vendored lc0 encoder or runs ONNX inference. Everything
 * else (`maiaAdapter.ts`, the rest of the app) talks to it only through the
 * plain-data protocol in `./protocol`, the same discipline
 * `stockfishAdapter.ts` already applies to Stockfish.
 *
 * Deliberately separate from the spike's worker: that one returns a full
 * move distribution plus timings for a diagnostics page; this one returns a
 * single sampled UCI move, which is all the game needs.
 */

import * as ort from "onnxruntime-web/wasm";
import { Chess } from "chess.js";
import type { MaiaWorkerRequest, MaiaWorkerResponse } from "./protocol";
import { boardToInputPlanes, encodeMove } from "./encoding/lc0Encoder";
import { pickMove } from "./policy";
import { reconstructStandardHistory } from "./historyReconstruct";
import type { RandomnessStop } from "@/engine/types";

// Self-hosted WASM runtime, no CDN -- offline play is a requirement. No
// COOP/COEP headers on this app, so no WASM threads.
ort.env.wasm.wasmPaths = "/maia/ort/";
ort.env.wasm.numThreads = 1;

let session: ort.InferenceSession | null = null;

function post(message: MaiaWorkerResponse): void {
  (self as unknown as Worker).postMessage(message);
}

async function handleLoad(modelUrl: string): Promise<void> {
  if (session) {
    await session.release();
    session = null;
  }
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  session = await ort.InferenceSession.create(buffer, { executionProviders: ["wasm"] });
  post({ type: "loaded" });
}

async function handleRequestMove(
  id: number,
  fen: string,
  moveHistory: string[],
  randomness: RandomnessStop,
): Promise<void> {
  if (!session) throw new Error("No model loaded");

  const chess = new Chess(fen);
  const us = chess.turn() === "w" ? "w" : "b";
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) throw new Error("No legal moves for a position that isn't over");

  const legalIndices = legalMoves.map((m) => encodeMove(m.from, m.to, m.promotion, us));
  const moveByIndex = new Map(legalMoves.map((m, k) => [legalIndices[k], m]));

  const priorFens = reconstructStandardHistory(fen, moveHistory) ?? [];
  const planes = boardToInputPlanes(fen, priorFens);

  const inputName = session.inputNames[0];
  const input = new ort.Tensor("float32", planes, [1, 112, 8, 8]);
  const outputs = await session.run({ [inputName]: input });
  const policyName = session.outputNames.find((n) => n.includes("policy")) ?? session.outputNames[0];
  const rawPolicy = outputs[policyName].data as Float32Array;

  const chosenIndex = pickMove(rawPolicy, legalIndices, randomness, Math.random);
  const chosenMove = moveByIndex.get(chosenIndex);
  if (!chosenMove) throw new Error(`Sampled policy index ${chosenIndex} has no matching legal move`);

  const uci = chosenMove.promotion
    ? `${chosenMove.from}${chosenMove.to}${chosenMove.promotion}`
    : `${chosenMove.from}${chosenMove.to}`;
  post({ type: "move", id, uci });
}

self.addEventListener("message", (event: MessageEvent<MaiaWorkerRequest>) => {
  const msg = event.data;
  (async () => {
    try {
      if (msg.type === "load") {
        await handleLoad(msg.modelUrl);
      } else if (msg.type === "requestMove") {
        await handleRequestMove(msg.id, msg.fen, msg.moveHistory, msg.randomness);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", id: msg.type === "requestMove" ? msg.id : undefined, message });
    }
  })();
});
