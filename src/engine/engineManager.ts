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

  /**
   * The generation a caller must remember at request time and re-check
   * before acting on a reply it held onto itself (e.g. behind a timer) —
   * `requestMove`'s own staleness check only covers the window up to when
   * `onMove` fires, not whatever a caller does with the result afterwards.
   */
  getGeneration(): number {
    return this.generation;
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

  /**
   * Invalidates any in-flight search without tearing down the engine: bumps
   * `generation` (so a reply that arrives later is dropped as stale) and
   * tells the adapter to stop searching. Call this whenever a game ends —
   * resignation, checkmate, an already-over set-up position — so nothing
   * from that game can ever be delivered to whatever comes next, and so the
   * search doesn't keep burning CPU after nobody cares about its answer.
   */
  abortSearch(): void {
    this.generation++;
    this.adapter.stop();
  }

  setLevel(level: EngineLevel): void {
    this.adapter.setLevel(level);
  }

  /**
   * Requests a move for `fen`. If a restart/abortSearch happens before this
   * resolves, the reply (or failure) is superseded and dropped silently —
   * `onMove`/`onError` simply never fire, so callers don't need to
   * re-check staleness themselves. A genuine failure — the adapter rejects,
   * or replies "(none)" for a position the caller believes is still live —
   * invokes `onError` exactly once so the caller can surface it and recover.
   */
  async requestMove(
    fen: string,
    moveHistory: string[],
    onMove: (uci: string) => void,
    onError: (err: Error) => void,
  ): Promise<void> {
    const requestGeneration = this.generation;
    const stale = () => requestGeneration !== this.generation;

    let uci: string;
    try {
      uci = await this.adapter.requestMove(fen, moveHistory);
    } catch (err) {
      if (stale()) return;
      onError(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    if (stale()) return;
    if (uci === "(none)") {
      onError(new Error("Engine returned no move for a position that isn't over"));
      return;
    }
    onMove(uci);
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
