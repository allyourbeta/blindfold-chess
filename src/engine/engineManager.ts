import type { EngineAdapter, EngineLevel } from "./types";

export type EngineStatus = "idle" | "loading" | "ready" | "failed";

export interface EngineManagerCallbacks {
  onStatusChange?(status: EngineStatus): void;
}

/**
 * Owns engine lifecycle: readiness, restart-on-new-game, and discarding
 * bestmove replies from a superseded search. This guarding lives here, not
 * in the adapter and not in components, so it works the same for any future
 * EngineAdapter implementation.
 */
export class EngineManager {
  private generation = 0;
  private status: EngineStatus = "idle";

  constructor(
    private adapter: EngineAdapter,
    private callbacks: EngineManagerCallbacks = {},
  ) {}

  getStatus(): EngineStatus {
    return this.status;
  }

  isReady(): boolean {
    return this.status === "ready" && this.adapter.isReady();
  }

  private setStatus(status: EngineStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  async load(): Promise<void> {
    this.setStatus("loading");
    try {
      await this.adapter.init();
      this.setStatus("ready");
    } catch (err) {
      this.setStatus("failed");
      throw err;
    }
  }

  /** Terminates any in-flight search and reloads the engine — safe to call mid-search. */
  async restart(): Promise<void> {
    this.generation++;
    this.adapter.dispose();
    await this.load();
  }

  setLevel(level: EngineLevel): void {
    this.adapter.setLevel(level);
  }

  /**
   * Requests a move for `fen`. If a restart happens before this resolves,
   * or the engine errors, the reply is dropped here — `onMove` simply never
   * fires, so callers don't need to re-check staleness themselves.
   */
  async requestMove(fen: string, moveHistory: string[], onMove: (uci: string) => void): Promise<void> {
    const requestGeneration = this.generation;
    let uci: string;
    try {
      uci = await this.adapter.requestMove(fen, moveHistory);
    } catch {
      return;
    }
    if (requestGeneration !== this.generation) return;
    if (uci && uci !== "(none)") onMove(uci);
  }

  stop(): void {
    this.adapter.stop();
  }

  dispose(): void {
    this.generation++;
    this.adapter.dispose();
    this.setStatus("idle");
  }
}
