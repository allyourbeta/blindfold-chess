import { EngineManager, type EngineManagerCallbacks } from "./engineManager";
import { StockfishAdapter } from "./stockfishAdapter";

/**
 * The one place the concrete Stockfish adapter is wired up. Everything
 * else in the app (including state/gameStore.ts) talks to the returned
 * EngineManager, never to StockfishAdapter directly — swapping in Maia in
 * Phase 2 means changing only this function.
 */
export function createEngineManager(callbacks?: EngineManagerCallbacks): EngineManager {
  return new EngineManager(new StockfishAdapter(), callbacks);
}
