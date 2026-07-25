export interface EngineLevel {
  label: string;
  depth: number;
  skill: number;
}

/**
 * The interface every engine plugs into. Phase 2 will add a second
 * implementation (Maia via ONNX Runtime Web) behind this same interface —
 * the rest of the app must never import an adapter directly, only this type
 * and engineManager.ts.
 */
export interface EngineAdapter {
  readonly id: string;
  init(): Promise<void>;
  isReady(): boolean;
  setLevel(level: EngineLevel): void;
  /** moveHistory isn't used by Stockfish but future adapters (Maia) need it. */
  requestMove(fen: string, moveHistory: string[]): Promise<string>;
  stop(): void;
  dispose(): void;
}
