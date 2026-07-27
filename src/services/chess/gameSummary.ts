import type { Chess, Color } from "chess.js";

export type GameEndReason =
  | "checkmate"
  | "stalemate"
  | "threefold-repetition"
  | "insufficient-material"
  | "fifty-move-rule"
  | "resignation";

export interface GameEndOutcome {
  reason: GameEndReason;
  text: string;
  historyResult: string;
}

export interface StoredGame {
  date: string;
  result: string;
  color: "White" | "Black";
  difficulty: string;
  moves: number;
  peeks: number;
  pgn: string;
  fen: string;
  durationSec: number;
}

/** Checks game-over conditions in the same priority order as the original app. */
export function detectGameOver(chess: Chess): GameEndReason | null {
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (chess.isThreefoldRepetition()) return "threefold-repetition";
  if (chess.isInsufficientMaterial()) return "insufficient-material";
  if (chess.isDrawByFiftyMoves()) return "fifty-move-rule";
  return null;
}

export function describeGameEnd(
  reason: GameEndReason,
  chess: Chess,
  playerColor: Color,
): GameEndOutcome {
  switch (reason) {
    case "checkmate": {
      const winner = chess.turn() === "w" ? "Black" : "White";
      const youWin = chess.turn() !== playerColor;
      return {
        reason,
        text: `Checkmate! ${winner} wins.`,
        historyResult: youWin ? "Win (checkmate)" : "Loss (checkmate)",
      };
    }
    case "stalemate":
      return { reason, text: "Stalemate. Draw.", historyResult: "Draw" };
    case "threefold-repetition":
      return { reason, text: "Threefold repetition. Draw.", historyResult: "Draw" };
    case "insufficient-material":
      return { reason, text: "Insufficient material. Draw.", historyResult: "Draw" };
    case "fifty-move-rule":
      return { reason, text: "Draw (50-move rule).", historyResult: "Draw" };
    case "resignation":
      return { reason, text: "You resigned.", historyResult: "Loss (resigned)" };
  }
}

/** "1. e4 e5  2. Nf3 Nc6" — shared by the move list, PGN copy, and saved history. */
export function formatMovePairs(moves: string[]): string {
  const pairs: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    const w = moves[i] || "";
    const b = moves[i + 1] || "";
    pairs.push(`${num}. ${w}${b ? " " + b : ""}`);
  }
  return pairs.join("  ");
}


/** Legal moves grouped by piece type, for the "hint" command. */
export function formatHint(chess: Chess): string {
  const moves = chess.moves();
  if (moves.length === 0) return "No legal moves.";

  const groups: Record<string, string[]> = { pawn: [], N: [], B: [], R: [], Q: [], K: [], castle: [] };
  for (const m of moves) {
    if (m === "O-O" || m === "O-O-O") groups.castle.push(m);
    else if (/^[NBRQK]/.test(m)) groups[m[0]].push(m);
    else groups.pawn.push(m);
  }

  const sections: string[] = [];
  if (groups.pawn.length) sections.push(groups.pawn.join(", "));
  for (const p of ["N", "B", "R", "Q", "K"]) {
    if (groups[p].length) sections.push(groups[p].join(", "));
  }
  if (groups.castle.length) sections.push(groups.castle.join(", "));

  return `${moves.length} legal moves: ${sections.join(" · ")}`;
}

/** "Recent games: ..." summary text for the "history" command. */
export function formatHistorySummary(history: StoredGame[]): string {
  if (!history.length) return "No games played yet.";

  const recent = history.slice(-5).reverse();
  const lines = recent.map((g) => {
    const date = new Date(g.date).toLocaleDateString();
    const mins = Math.floor(g.durationSec / 60);
    return `  ${date} · ${g.color} · ${g.difficulty} · ${g.moves} moves · ${g.peeks} peeks · ${mins}m · ${g.result}`;
  });

  const totalGames = history.length;
  const wins = history.filter((g) => /win/i.test(g.result)).length;
  const avgPeeks = (history.reduce((s, g) => s + g.peeks, 0) / totalGames).toFixed(1);

  return [
    "Recent games:",
    ...lines,
    "",
    `  Totals: ${totalGames} games · ${wins} wins · avg ${avgPeeks} peeks/game`,
  ].join("\n");
}
