import { Chess } from "chess.js";
import { STARTING_FEN } from "@/services/chess/fen";

/**
 * Recovers a standard game's true position history from its move list, for
 * `boardToInputPlanes`' `priorFens` parameter.
 *
 * `EngineAdapter.requestMove(fen, moveHistory)` never receives the game's
 * actual starting FEN, only the current FEN and the SAN moves played so
 * far -- so this is the only way to tell a standard game (one that began at
 * the universal starting position, where the full real history is known)
 * apart from a custom-FEN game (where anything before the setup FEN is
 * unknowable): replay `moveHistorySan` from `STARTING_FEN` and check it
 * reproduces `fen` exactly. A custom-FEN game's replay either diverges
 * immediately (different start) or never matches (different position
 * entirely), so this same check naturally covers both.
 *
 * Returns the chronological list of FENs strictly before `fen` (oldest
 * first), or null if the replay doesn't reproduce `fen` -- callers should
 * treat null the same as "no history known".
 */
export function reconstructStandardHistory(fen: string, moveHistorySan: readonly string[]): string[] | null {
  if (moveHistorySan.length === 0) return [];

  const chess = new Chess(STARTING_FEN);
  const priorFens: string[] = [];
  for (const san of moveHistorySan) {
    priorFens.push(chess.fen());
    try {
      chess.move(san);
    } catch {
      return null;
    }
  }
  return chess.fen() === fen ? priorFens : null;
}
