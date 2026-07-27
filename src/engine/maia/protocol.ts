import type { RandomnessStop } from "@/engine/types";

/**
 * Message protocol between `MaiaAdapter` and `maia.worker.ts` -- plain data
 * only, the same worker-boundary discipline `stockfishAdapter.ts` already
 * uses. This is a separate, leaner protocol from the spike's
 * (`../../maia-spike/adapter/protocol.ts`): the game only ever needs a
 * single sampled UCI move back, never the full move distribution the spike
 * displays for diagnostics.
 */
export type MaiaWorkerRequest =
  | { type: "load"; modelUrl: string }
  | { type: "requestMove"; id: number; fen: string; moveHistory: string[]; randomness: RandomnessStop };

export type MaiaWorkerResponse =
  | { type: "loaded" }
  | { type: "move"; id: number; uci: string }
  | { type: "error"; id?: number; message: string };
