/// <reference lib="webworker" />
/**
 * The Maia inference worker. This is the GPL-isolation boundary: it is the
 * only place that imports the vendored lc0 encoder/decoder and runs ONNX
 * inference. Everything outside this file (the adapter, the page) talks to
 * it only through the plain-data message protocol in `../adapter/protocol`,
 * the same way `stockfishAdapter.ts` never touches Stockfish internals
 * directly. See CREDITS.md.
 *
 * Self-contained bundle: Vite builds this as its own worker chunk (module
 * worker), so none of this ends up inside the main app's JS.
 */

import * as ort from "onnxruntime-web/wasm";
import type { MaiaWorkerRequest, MaiaWorkerResponse, MaiaTimings } from "../adapter/protocol";
import { evaluatePosition } from "../inference/evaluatePosition";

// Self-hosted WASM runtime: no CDN, offline is a requirement of the eventual
// feature. No COOP/COEP headers on this app, so no WASM threads.
ort.env.wasm.wasmPaths = "/maia/ort/";
ort.env.wasm.numThreads = 1;

let session: ort.InferenceSession | null = null;

function post(message: MaiaWorkerResponse, transfer?: Transferable[]): void {
  if (transfer) {
    (self as unknown as Worker).postMessage(message, transfer);
  } else {
    (self as unknown as Worker).postMessage(message);
  }
}

async function downloadModel(modelUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);

  const contentLength = Number(response.headers.get("Content-Length") ?? 0);
  const reader = response.body?.getReader();
  if (!reader) return response.arrayBuffer();

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (contentLength > 0) {
      post({ type: "load-progress", loadedBytes: received, totalBytes: contentLength });
    }
  }
  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return buffer.buffer;
}

async function handleLoad(modelUrl: string, modelId: string): Promise<void> {
  // Hold at most one session at a time.
  if (session) {
    await session.release();
    session = null;
  }

  const downloadStart = performance.now();
  const buffer = await downloadModel(modelUrl);
  const downloadMs = performance.now() - downloadStart;

  const sessionStart = performance.now();
  session = await ort.InferenceSession.create(buffer, { executionProviders: ["wasm"] });
  const sessionCreateMs = performance.now() - sessionStart;

  const timings: MaiaTimings = { downloadMs, sessionCreateMs };
  post({ type: "loaded", modelId, timings });
}

async function handleEvaluate(id: number, fen: string): Promise<void> {
  if (!session) throw new Error("No model loaded");
  const start = performance.now();
  const result = await evaluatePosition(session, ort.Tensor, fen);
  const inferenceMs = performance.now() - start;
  post({ type: "evaluated", id, fen, result, timings: { inferenceMs } });
}

self.addEventListener("message", (event: MessageEvent<MaiaWorkerRequest>) => {
  const msg = event.data;
  (async () => {
    try {
      if (msg.type === "load") {
        await handleLoad(msg.modelUrl, msg.modelId);
      } else if (msg.type === "evaluate") {
        await handleEvaluate(msg.id, msg.fen);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", id: msg.type === "evaluate" ? msg.id : undefined, message });
    }
  })();
});
