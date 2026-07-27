/**
 * Message protocol between the lab-bench page and the Maia worker. Plain
 * data only -- this is the worker boundary: nothing on this side ever
 * imports the vendored encoder, mirroring how stockfishAdapter talks to its
 * worker only over postMessage.
 */

export interface MaiaMoveProbability {
  uci: string;
  probability: number;
}

export interface MaiaEvaluation {
  moves: MaiaMoveProbability[];
  wdl: [number, number, number];
  value: number;
}

export interface MaiaTimings {
  downloadMs?: number;
  sessionCreateMs?: number;
  inferenceMs?: number;
}

export type MaiaWorkerRequest =
  | { type: "load"; modelUrl: string; modelId: string }
  | { type: "evaluate"; id: number; fen: string };

export type MaiaWorkerResponse =
  | { type: "load-progress"; loadedBytes: number; totalBytes: number }
  | { type: "loaded"; modelId: string; timings: MaiaTimings }
  | { type: "evaluated"; id: number; fen: string; result: MaiaEvaluation; timings: MaiaTimings }
  | { type: "error"; id?: number; message: string };
