import type { EngineAdapter, EngineLevel } from "./types";

const ENGINE_URL = "/engine/stockfish.js";

/**
 * A worker that loads but never answers "isready" (a corrupt cache entry, a
 * stalled service worker) would otherwise hang the menu on "Loading
 * Stockfish..." forever with no failure state. 10s is generous for an
 * asm.js parse+init even on a slow phone, while still failing fast enough
 * for the retry UI to appear promptly.
 */
const INIT_TIMEOUT_MS = 10_000;

interface PendingMove {
  resolve(uci: string): void;
  reject(err: Error): void;
}

/** Self-hosted Stockfish 10.0.2 (asm.js), driven over the UCI protocol via postMessage. */
export class StockfishAdapter implements EngineAdapter {
  readonly id = "stockfish";

  private worker: Worker | null = null;
  private ready = false;
  private level: EngineLevel = { label: "", depth: 10, skill: 10 };
  private pendingMove: PendingMove | null = null;
  private initTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private clearInitTimeout(): void {
    if (this.initTimeoutId !== null) {
      clearTimeout(this.initTimeoutId);
      this.initTimeoutId = null;
    }
  }

  init(): Promise<void> {
    this.dispose();
    return new Promise<void>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(ENGINE_URL);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      this.worker = worker;

      this.initTimeoutId = setTimeout(() => {
        this.initTimeoutId = null;
        this.dispose();
        reject(new Error("Stockfish init timed out"));
      }, INIT_TIMEOUT_MS);

      worker.onmessage = (e: MessageEvent) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (line.includes("uciok")) {
          worker.postMessage("isready");
        } else if (line.includes("readyok")) {
          this.ready = true;
          this.clearInitTimeout();
          resolve();
        } else if (line.startsWith("bestmove")) {
          const move = line.split(" ")[1];
          this.pendingMove?.resolve(move);
          this.pendingMove = null;
        }
      };

      worker.onerror = () => {
        this.ready = false;
        this.clearInitTimeout();
        const err = new Error("Stockfish worker error");
        this.pendingMove?.reject(err);
        this.pendingMove = null;
        reject(err);
      };

      worker.postMessage("uci");
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  setLevel(level: EngineLevel): void {
    this.level = level;
  }

  requestMove(fen: string, _moveHistory: string[]): Promise<string> {
    if (!this.worker || !this.ready) return Promise.reject(new Error("Engine not ready"));

    // A caller should always stop/restart before requesting again, but
    // guard against a stray overlapping call so no promise is ever left
    // dangling.
    this.pendingMove?.reject(new Error("Superseded by a new request"));

    const worker = this.worker;
    return new Promise<string>((resolve, reject) => {
      this.pendingMove = { resolve, reject };
      worker.postMessage(`setoption name Skill Level value ${this.level.skill}`);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${this.level.depth}`);
    });
  }

  stop(): void {
    this.worker?.postMessage("stop");
  }

  dispose(): void {
    this.clearInitTimeout();
    this.pendingMove?.reject(new Error("Engine disposed"));
    this.pendingMove = null;
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
