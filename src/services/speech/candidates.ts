import type { Move } from "chess.js";
import { PIECE_WORDS, PIECE_LETTERS, getDisambiguator, fileOf, rankOf } from "../chess/san";

const DIGIT_WORDS: Record<string, string> = {
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
};

function destForms(square: string): string[] {
  const file = fileOf(square);
  const rank = rankOf(square);
  return [`${file}${rank}`, `${file} ${rank}`, `${file} ${DIGIT_WORDS[rank]}`];
}

function pawnCandidates(move: Move): string[] {
  const candidates = new Set<string>();
  const toCompact = move.to;

  if (move.isCapture()) {
    const fromFile = fileOf(move.from);
    for (const dest of destForms(move.to)) {
      candidates.add(`${fromFile} takes ${dest}`);
      candidates.add(`pawn ${fromFile} takes ${dest}`);
    }
    candidates.add(`${fromFile}x${toCompact}`);
  } else {
    for (const dest of destForms(move.to)) {
      candidates.add(dest);
      candidates.add(`pawn ${dest}`);
      candidates.add(`pawn to ${dest}`);
    }
  }
  return [...candidates];
}

function pieceCandidates(move: Move): string[] {
  const candidates = new Set<string>();
  const pieceWord = PIECE_WORDS[move.piece];
  const pieceLetter = PIECE_LETTERS[move.piece];
  const isCapture = move.isCapture();
  const verb = isCapture ? "takes" : "to";
  const disambiguator = getDisambiguator(move);

  if (disambiguator) {
    const spaced = disambiguator.split("").join(" ");
    for (const dest of destForms(move.to)) {
      candidates.add(`${pieceWord} ${spaced} ${dest}`);
      candidates.add(`${pieceWord} from ${spaced} ${verb} ${dest}`);
    }
  } else {
    for (const dest of destForms(move.to)) {
      candidates.add(`${pieceWord} ${dest}`);
      candidates.add(`${pieceWord} ${verb} ${dest}`);
    }
    candidates.add(`${pieceLetter} ${move.to}`);
  }

  if (isCapture) {
    candidates.add(`${pieceWord} captures ${move.to}`);
    candidates.add(`${pieceWord} x ${move.to}`);
  }
  return [...candidates];
}

/**
 * Every plausible way a player might say this legal move aloud. Used by
 * match.ts to score a heard transcript against the full legal move list.
 */
export function generateMoveCandidates(move: Move): string[] {
  if (move.isKingsideCastle()) {
    return ["castles kingside", "castle kingside", "o o", "king side castle"];
  }
  if (move.isQueensideCastle()) {
    return ["castles queenside", "castle queenside", "o o o", "queen side castle"];
  }

  const base = move.piece === "p" ? pawnCandidates(move) : pieceCandidates(move);

  if (!move.promotion) return base;

  const promoWord = PIECE_WORDS[move.promotion];
  const withPromotion = base.flatMap((c) => [`${c} promotes to ${promoWord}`, `${c} ${promoWord}`]);
  return [...base, ...withPromotion];
}
