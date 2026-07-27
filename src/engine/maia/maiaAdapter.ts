import type { EngineAdapter, EngineLevel, RandomnessStop } from "@/engine/types";
import type { MaiaWorkerRequest, MaiaWorkerResponse } from "./protocol";

const MODEL_URL = "/maia/models/maia_kdd_1900.onnx";

/**
 * The model is 3.32 MiB (see MODELS.md). Budgeting the same per-KB mobile
 * throughput `stockfishAdapter.ts` assumes for its own self-hosted asset
 * (1.58 MB in 10s) scales to ~22s for the download alone; ONNX Runtime then
 * still has to instantiate a WASM inference session from that graph, which
 * is not instant on a phone-class CPU. 25s leaves headroom for both without
 * making a genuinely stuck load look identical to a slow one for that long.
 */
const INIT_TIMEOUT_MS = 25_000;

interface PendingMove {
  resolve(uci: string): void;
  reject(err: Error): void;
}

/** Maia (maia_kdd_1900), driven over a plain-data protocol via postMessage -- see ./protocol and ./maia.worker.ts. */
export class MaiaAdapter implements EngineAdapter {
  readonly id = "maia";

  private worker: Worker | null = null;
  private ready = false;
  private randomness: RandomnessStop = "human";
  private pendingMove: PendingMove | null = null;
  private pendingMoveId = -1;
  private nextRequestId = 0;
  private initTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private clearInitTimeout(): void {
    if (this.initTimeoutId !== null) {
      clearTimeout(this.initTimeoutId);
      this.initTimeoutId = null;
    }
  }

  private post(message: MaiaWorkerRequest): void {
    this.worker?.postMessage(message);
  }

  init(): Promise<void> {
    this.dispose();
    return new Promise<void>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL("./maia.worker.ts", import.meta.url), { type: "module" });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      this.worker = worker;

      this.initTimeoutId = setTimeout(() => {
        this.initTimeoutId = null;
        this.dispose();
        reject(new Error("Maia init timed out"));
      }, INIT_TIMEOUT_MS);

      worker.onmessage = (e: MessageEvent<MaiaWorkerResponse>) => {
        const msg = e.data;
        if (msg.type === "loaded") {
          this.ready = true;
          this.clearInitTimeout();
          resolve();
        } else if (msg.type === "move") {
          if (msg.id === this.pendingMoveId) {
            this.pendingMove?.resolve(msg.uci);
            this.pendingMove = null;
          }
        } else if (msg.type === "error") {
          if (msg.id === undefined) {
            // A load failure: no session was ever created.
            this.clearInitTimeout();
            reject(new Error(msg.message));
          } else if (msg.id === this.pendingMoveId) {
            this.pendingMove?.reject(new Error(msg.message));
            this.pendingMove = null;
          }
        }
      };

      worker.onerror = (e: ErrorEvent) => {
        const err = new Error(e.message || "Maia worker error");
        this.ready = false;
        this.clearInitTimeout();
        this.pendingMove?.reject(err);
        this.pendingMove = null;
        reject(err);
      };

      this.post({ type: "load", modelUrl: MODEL_URL });
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  setLevel(level: EngineLevel): void {
    this.randomness = level.randomness ?? "human";
  }

  requestMove(fen: string, moveHistory: string[]): Promise<string> {
    if (!this.worker || !this.ready) return Promise.reject(new Error("Engine not ready"));

    // A caller should always stop/restart before requesting again, but
    // guard against a stray overlapping call so no promise is ever left
    // dangling -- same discipline as stockfishAdapter.
    this.pendingMove?.reject(new Error("Superseded by a new request"));

    const id = this.nextRequestId++;
    this.pendingMoveId = id;
    return new Promise<string>((resolve, reject) => {
      this.pendingMove = { resolve, reject };
      this.post({ type: "requestMove", id, fen, moveHistory, randomness: this.randomness });
    });
  }

  /**
   * There's no way to interrupt an in-flight ONNX `session.run()` inside
   * the worker, so "abandon" means: settle the caller's promise now rather
   * than making it wait for a result nobody wants, and clear
   * `pendingMoveId` so that when the worker's reply eventually does arrive,
   * the `msg.id === this.pendingMoveId` guards above see it as stale and
   * drop it (rather than, worse, resolving whatever *new* request has since
   * become `pendingMove`).
   */
  stop(): void {
    this.pendingMove?.reject(new Error("Superseded by a new request"));
    this.pendingMove = null;
    this.pendingMoveId = -1;
  }

  dispose(): void {
    this.clearInitTimeout();
    this.pendingMove?.reject(new Error("Engine disposed"));
    this.pendingMove = null;
    this.pendingMoveId = -1;
    this.ready = false;
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // already gone
      }
      this.worker = null;
    }
  }
}
