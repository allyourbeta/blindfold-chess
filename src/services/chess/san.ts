import type { Move, PieceSymbol } from "chess.js";

/**
 * The vocabulary of spoken words a move (or move fragment) can be built
 * from. Each value is also the id of a generated audio clip in
 * public/audio/<id>.wav — see scripts/generate-speech-clips.sh.
 */
export type SpokenPart =
  | "king"
  | "queen"
  | "rook"
  | "bishop"
  | "knight"
  | "pawn"
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "takes"
  | "to"
  | "from"
  | "check"
  | "checkmate"
  | "castles-kingside"
  | "castles-queenside"
  | "promotes-to"
  | "en-passant"
  | "stalemate"
  | "not-legal"
  | "ambiguous"
  | "draw";

export const PIECE_WORDS: Record<PieceSymbol, SpokenPart> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

/** Single-letter SAN piece abbreviation, empty string for pawns. */
export const PIECE_LETTERS: Record<PieceSymbol, string> = {
  p: "",
  n: "n",
  b: "b",
  r: "r",
  q: "q",
  k: "k",
};

export function fileOf(square: string): SpokenPart {
  return square[0] as SpokenPart;
}

export function rankOf(square: string): SpokenPart {
  return square[1] as SpokenPart;
}

/**
 * The SAN disambiguator between the piece letter and the destination
 * square — e.g. "b" in "Nbd2", "1" in "N1d2", "h4" in the rare full-square
 * disambiguation "Qh4e1". Empty for moves that don't need one.
 */
export function getDisambiguator(move: Move): string {
  const match = move.san.match(/^[NBRQK]([a-h]?[1-8]?)x?[a-h][1-8]/);
  return match ? match[1] : "";
}

/**
 * A verbose chess.js move → the ordered list of spoken parts describing it,
 * built from the move's structured fields (piece/from/to/captured/
 * promotion), not by string-replacing the SAN text.
 */
export function movePhraseParts(move: Move): SpokenPart[] {
  const parts: SpokenPart[] = [];

  if (move.isKingsideCastle()) {
    parts.push("castles-kingside");
  } else if (move.isQueensideCastle()) {
    parts.push("castles-queenside");
  } else {
    parts.push(PIECE_WORDS[move.piece]);

    if (move.piece === "p" && move.isCapture()) {
      // Pawn captures are always disambiguated by origin file in SAN (exd5).
      parts.push(fileOf(move.from));
      parts.push("takes");
    } else {
      const disambiguator = getDisambiguator(move);
      if (disambiguator) {
        parts.push("from");
        for (const ch of disambiguator) {
          parts.push(ch as SpokenPart);
        }
      }
      parts.push(move.isCapture() ? "takes" : "to");
    }

    parts.push(fileOf(move.to));
    parts.push(rankOf(move.to));

    if (move.isEnPassant()) {
      parts.push("en-passant");
    }
    if (move.promotion) {
      parts.push("promotes-to");
      parts.push(PIECE_WORDS[move.promotion]);
    }
  }

  if (move.san.includes("#")) parts.push("checkmate");
  else if (move.san.includes("+")) parts.push("check");

  return parts;
}
