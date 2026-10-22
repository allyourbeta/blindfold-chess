import type { OpponentKind, RandomnessStop } from "./types";
import { RANDOMNESS_STOPS } from "./maia/policy";
import { STOCKFISH_LEVELS, type StockfishLevelKey } from "./stockfishLevels";

/** The model's name, not a strength promise -- see SPEC_maia_integrate.md. Shared by gameFlow (status line) and MenuScreen (chip, loading text). */
export function opponentName(opponent: OpponentKind): string {
  return opponent === "stockfish" ? "Stockfish" : "Maia 1900";
}

/** Maia's randomness label, or Stockfish's level label -- whichever dial the current opponent actually has. */
export function levelLabel(
  opponent: OpponentKind,
  randomness: RandomnessStop,
  stockfishLevel: StockfishLevelKey,
): string {
  if (opponent === "stockfish") {
    return STOCKFISH_LEVELS.find((l) => l.value === stockfishLevel)?.label ?? "Club";
  }
  return RANDOMNESS_STOPS.find((s) => s.value === randomness)?.label ?? "Human";
}
