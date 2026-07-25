export type TypedCommand = "peek" | "resign" | "takeback" | "hint" | "fen" | "pgn" | "history";

/** Recognizes the typed-in-the-move-box shortcuts (spec §3.1's "peek", "hint", etc). */
export function parseTypedCommand(raw: string): TypedCommand | null {
  const lower = raw.trim().toLowerCase();
  switch (lower) {
    case "peek":
      return "peek";
    case "resign":
      return "resign";
    case "takeback":
    case "undo":
      return "takeback";
    case "hint":
    case "moves":
    case "help":
      return "hint";
    case "fen":
      return "fen";
    case "pgn":
      return "pgn";
    case "history":
    case "stats":
      return "history";
    default:
      return null;
  }
}
