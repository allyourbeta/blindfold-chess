import { EngineManager, type EngineManagerCallbacks } from "./engineManager";
import { MaiaAdapter } from "./maia/maiaAdapter";

/**
 * The one place the concrete engine adapter is wired up. Everything else in
 * the app (including state/gameStore.ts) talks to the returned
 * EngineManager, never to an adapter directly. Maia is the opponent now;
 * `StockfishAdapter` stays fully in the codebase (see SPEC_maia_integrate.md
 * — a future deterministic-analysis feature may want it) but nothing
 * constructs it for play anymore.
 */
export function createEngineManager(callbacks?: EngineManagerCallbacks): EngineManager {
  return new EngineManager(new MaiaAdapter(), callbacks);
}
