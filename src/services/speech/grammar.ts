import type { PieceSymbol } from "chess.js";
import { PIECE_WORDS, PIECE_LETTERS } from "../chess/san";

/**
 * Every piece-to-square move a player could *say*, whether or not it is legal
 * in the current position.
 *
 * This exists so the app can tell "I misheard you" apart from "what you said
 * isn't a legal move". Matching only against legal moves can never produce the
 * second answer — it can only ever return the nearest legal move, which is how
 * a spoken "knight d4" ended up played as Nxc3.
 *
 * 6 pieces x 64 squares = 384 entries, built once and reused.
 */

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;
const PIECES: PieceSymbol[] = ["k", "q", "r", "b", "n", "p"];

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

export interface GrammarEntry {
  piece: PieceSymbol;
  to: string;
  /** How it's written back to the player, e.g. "Knight d4" or "Pawn e5". */
  label: string;
  phrases: string[];
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function entryFor(piece: PieceSymbol, to: string): GrammarEntry {
  const word = PIECE_WORDS[piece];
  const letter = PIECE_LETTERS[piece];
  const file = to[0];
  const rank = to[1];
  const spacedDest = `${file} ${rank}`;
  const wordyDest = `${file} ${DIGIT_WORDS[rank]}`;

  const phrases =
    piece === "p"
      ? [to, spacedDest, wordyDest, `pawn ${to}`, `pawn to ${to}`, `takes ${to}`]
      : [
          `${word} ${to}`,
          `${word} ${spacedDest}`,
          `${word} to ${to}`,
          `${word} takes ${to}`,
          `${word} ${wordyDest}`,
          `${letter} ${to}`.toLowerCase(),
        ];

  return { piece, to, label: `${capitalise(word)} ${to}`, phrases };
}

let cached: GrammarEntry[] | null = null;

/** The full sayable-move grammar. Built on first use, then reused. */
export function moveGrammar(): GrammarEntry[] {
  if (cached) return cached;
  const entries: GrammarEntry[] = [];
  for (const piece of PIECES) {
    for (const file of FILES) {
      for (const rank of RANKS) {
        entries.push(entryFor(piece, `${file}${rank}`));
      }
    }
  }
  cached = entries;
  return entries;
}
