import type { EngineAdapter, EngineLevel, OpponentKind } from "./types";
import { MaiaAdapter } from "./maia/maiaAdapter";
import { StockfishAdapter } from "./stockfishAdapter";

/**
 * Routes every EngineAdapter call to whichever opponent is currently
 * selected. Owns one instance of each adapter, created lazily on first use,
 * and disposes the other one on every init() so at most one engine is ever
 * live. The settings store is never imported here -- the caller supplies
 * `getOpponent` so this layer stays independent of it.
 *
 * `makeMaia`/`makeStockfish` default to the real adapters; tests override
 * them with fakes instead of reaching for the concrete engine classes.
 */
export class OpponentAdapter implements EngineAdapter {
  private maia: EngineAdapter | null = null;
  private stockfish: EngineAdapter | null = null;
  private active: EngineAdapter | null = null;

  constructor(
    private getOpponent: () => OpponentKind,
    private makeMaia: () => EngineAdapter = () => new MaiaAdapter(),
    private makeStockfish: () => EngineAdapter = () => new StockfishAdapter(),
  ) {}

  get id(): string {
    return this.active?.id ?? "none";
  }

  async init(): Promise<void> {
    const kind = this.getOpponent();
    if (kind === "stockfish") {
      this.maia?.dispose();
      if (!this.stockfish) this.stockfish = this.makeStockfish();
      this.active = this.stockfish;
    } else {
      this.stockfish?.dispose();
      if (!this.maia) this.maia = this.makeMaia();
      this.active = this.maia;
    }
    await this.active.init();
  }

  isReady(): boolean {
    return this.active?.isReady() ?? false;
  }

  setLevel(level: EngineLevel): void {
    this.active?.setLevel(level);
  }

  requestMove(fen: string, moveHistory: string[]): Promise<string> {
    if (!this.active) return Promise.reject(new Error("Engine not initialized"));
    return this.active.requestMove(fen, moveHistory);
  }

  stop(): void {
    this.active?.stop();
  }

  dispose(): void {
    this.active?.dispose();
  }
}
