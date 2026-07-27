/** The five worded stops on the randomness slider — see SPEC_maia_integrate.md. */
export type RandomnessStop = "predictable" | "focused" | "human" | "loose" | "wild";

/**
 * `depth`/`skill` are Stockfish's dials; `randomness` is Maia's. Both are
 * optional so each adapter reads only the field it understands, rather than
 * overloading one shared pair of numbers across two unrelated engines.
 */
export interface EngineLevel {
  label: string;
  depth?: number;
  skill?: number;
  randomness?: RandomnessStop;
}

/**
 * The interface every engine plugs into. Maia (ONNX Runtime Web) is the
 * second implementation behind this same interface — the rest of the app
 * must never import an adapter directly, only this type and
 * engineManager.ts.
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
