/** The four worded stops on Stockfish's level control -- see SPEC_log_opponent_style.md Part B. No Elo claims. */
export type StockfishLevelKey = "easy" | "club" | "strong" | "max";

export const STOCKFISH_LEVELS: ReadonlyArray<{
  value: StockfishLevelKey;
  label: string;
  skill: number;
  depth: number;
}> = [
  { value: "easy", label: "Easy", skill: 2, depth: 4 },
  { value: "club", label: "Club", skill: 8, depth: 8 },
  { value: "strong", label: "Strong", skill: 15, depth: 12 },
  { value: "max", label: "Max", skill: 20, depth: 14 },
];
