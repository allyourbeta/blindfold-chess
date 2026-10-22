import { EngineManager, type EngineManagerCallbacks } from "./engineManager";
import { OpponentAdapter } from "./opponentAdapter";
import type { OpponentKind } from "./types";

/**
 * The one place the concrete engine adapter is wired up. Everything else in
 * the app (including state/gameStore.ts) talks to the returned
 * EngineManager, never to an adapter directly. `getOpponent` lets the
 * router adapter pick Maia or Stockfish per game without this layer ever
 * importing the settings store itself -- see SPEC_log_opponent_style.md Part B.
 */
export function createEngineManager(
  callbacks: EngineManagerCallbacks | undefined,
  getOpponent: () => OpponentKind,
): EngineManager {
  return new EngineManager(new OpponentAdapter(getOpponent), callbacks);
}
