/**
 * Board encoding and move index mapping for the classic Maia / lc0 KDD models
 * (maia_kdd_1900, maia_kdd_1800). These models take the standard lc0
 * "112-plane classical" input format, not CSSLab's newer elo-conditioned
 * frontend format -- see CREDITS.md for why.
 *
 * Ported (with one bug fix, documented below) from lczerolens (MIT License),
 * src/lczerolens/board.py, `LczeroBoard`. Source:
 * https://github.com/Xmaster6y/lczerolens (commit 8b7f336c11b7df73f79fb78d65c9e23094527c90)
 *
 * Divergences from the source (see CREDITS.md for the full list):
 *  - Python (python-chess) rewritten as TypeScript (chess.js), since that
 *    is a language change, not a mechanical import swap.
 *  - `decode_move` fixes a real bug in the upstream: the original drops the
 *    promotion-piece suffix when reconstructing the UCI string, and its
 *    "is this a pawn reaching the back rank" guard compares a chess.Piece
 *    object to a piece-type int, which is always false in python-chess. Both
 *    together mean upstream `decode_move` never reconstructs a promotion at
 *    all (queen, rook, bishop, or knight) -- verified empirically against
 *    the real upstream code, see the spike report.
 *  - History planes: this app only ever has a single FEN snapshot, never a
 *    real move history (see SPEC_maia_spike.md's note that `moveHistory` is
 *    empty for games started from a custom FEN). lczerolens offers four
 *    named `InputEncoding` modes for this and none of them is what real lc0
 *    actually does by default. Real lc0's default `HistoryFill` UCI option
 *    is "fen_only", and reading lc0's own src/neural/encoder.cc directly
 *    (EncodePositionForNN) shows that for the legacy
 *    INPUT_CLASSICAL_112_PLANE format, when only one position is known, it
 *    REPEATS that position across all 8 history planes -- UNLESS the
 *    position is exactly the standard starting position, in which case
 *    history planes beyond the current one are left zero. That is what
 *    `boardToInputPlanes` below implements; it is not a straight port of
 *    any single lczerolens function, so treat it as the least-verified part
 *    of this port and see the report for how much to trust it.
 */

import { Chess } from "chess.js";
import { POLICY_INDEX } from "./policyIndex";

const INVERTED_POLICY_INDEX: ReadonlyMap<string, number> = new Map(
  POLICY_INDEX.map((move, index) => [move, index]),
);

export const NUM_POLICY_MOVES = POLICY_INDEX.length; // 1858

const FILES = "abcdefgh";

function squareIndex(name: string): number {
  const file = FILES.indexOf(name[0]);
  const rank = Number(name[1]) - 1;
  return rank * 8 + file;
}

function squareName(square: number): string {
  const file = square % 8;
  const rank = Math.floor(square / 8);
  return FILES[file] + String(rank + 1);
}

/** 180-degree point rotation used by lc0 for the side-to-move-relative move encoding. */
function rotateSquare(square: number): number {
  const row = Math.floor(square / 8);
  const col = square % 8;
  return 8 * (7 - row) + col;
}

type Side = "w" | "b";

/**
 * Converts a chess.Move's promotion field ('q'|'r'|'b'|'n'|undefined) to the
 * suffix character POLICY_INDEX uses. Knight promotion has no suffix -- it's
 * the default when a pawn move's destination is the back rank and no other
 * suffix matches.
 */
function promotionSuffix(promotion: string | undefined): string {
  if (promotion === "q" || promotion === "r" || promotion === "b") return promotion;
  return "";
}

/** Encodes a move (from chess.js's move shape) to its policy index. Mirrors `LczeroBoard.encode_move`. */
export function encodeMove(from: string, to: string, promotion: string | undefined, us: Side): number {
  let fromSq = squareIndex(from);
  let toSq = squareIndex(to);
  if (us === "b") {
    fromSq = rotateSquare(fromSq);
    toSq = rotateSquare(toSq);
  }
  const uci = squareName(fromSq) + squareName(toSq) + promotionSuffix(promotion);
  const index = INVERTED_POLICY_INDEX.get(uci);
  if (index === undefined) {
    throw new Error(`No policy index for move ${from}${to}${promotion ?? ""} (us=${us})`);
  }
  return index;
}

export interface DecodedMove {
  from: string;
  to: string;
  /** 'q' | 'r' | 'b' | 'n', only set when this decodes to a promotion. */
  promotion?: string;
}

/**
 * Decodes a policy index back to a move, given the side to move and a way to
 * check whether the piece on a given square is a pawn (needed to tell a
 * genuine promotion apart from a coincidentally-shaped index).
 *
 * Mirrors `LczeroBoard.decode_move`, with the promotion-suffix bug fixed --
 * see the module-level comment.
 */
export function decodeMove(index: number, us: Side, isPawnAt: (square: string) => boolean): DecodedMove {
  const raw = POLICY_INDEX[index];
  if (raw === undefined) {
    throw new Error(`Policy index ${index} out of range`);
  }
  let fromSq = squareIndex(raw.slice(0, 2));
  let toSq = squareIndex(raw.slice(2, 4));
  const promoChar = raw.slice(4, 5) || undefined;

  if (us === "b") {
    fromSq = rotateSquare(fromSq);
    toSq = rotateSquare(toSq);
  }

  const from = squareName(fromSq);
  const to = squareName(toSq);
  const isBackRank = toSq >= 56 || toSq < 8;

  if (isBackRank && isPawnAt(from)) {
    return { from, to, promotion: promoChar ?? "n" };
  }
  return { from, to };
}

const PIECE_ORDER_WHITE_FIRST = "PNBRQK";
const PIECE_ORDER_BLACK_FIRST = "pnbrqk";

function planeOrder(us: Side): string {
  return us === "w"
    ? PIECE_ORDER_WHITE_FIRST + PIECE_ORDER_BLACK_FIRST
    : PIECE_ORDER_BLACK_FIRST + PIECE_ORDER_WHITE_FIRST;
}

/**
 * Builds the 13-plane (12 piece planes + repetition) config tensor for one
 * position, from the mover's point of view. Mirrors `to_config_tensor`.
 *
 * The repetition plane is always left at 0: this app only ever has a single
 * FEN snapshot, never real history, so repetition is unknowable (and, per
 * lc0's own encoder, correctly assumed absent when history is unavailable).
 */
function configTensorFromFen(fen: string, us: Side): Float32Array {
  const tensor = new Float32Array(13 * 8 * 8);
  const order = planeOrder(us);
  const boardField = fen.split(" ")[0];
  const rows = boardField.split("/"); // rows[0] = rank 8 ... rows[7] = rank 1

  for (let rankFromTop = 0; rankFromTop < 8; rankFromTop++) {
    const rankIndex = 7 - rankFromTop; // 0 = rank1 ... 7 = rank8, matching square indexing
    let file = 0;
    for (const char of rows[rankFromTop]) {
      const emptyCount = Number(char);
      if (Number.isNaN(emptyCount)) {
        const planeIdx = order.indexOf(char);
        if (planeIdx >= 0 && planeIdx < 12) {
          const square = rankIndex * 8 + file;
          tensor[planeIdx * 64 + square] = 1.0;
        }
        file += 1;
      } else {
        file += emptyCount;
      }
    }
  }

  if (us === "b") {
    // Flip vertically (rank axis only, files unchanged) so the board reads
    // from the mover's point of view -- matches `config_tensor.flip(1)`.
    const flipped = new Float32Array(13 * 8 * 8);
    for (let plane = 0; plane < 13; plane++) {
      for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
          const src = plane * 64 + rank * 8 + file;
          const dst = plane * 64 + (7 - rank) * 8 + file;
          flipped[dst] = tensor[src];
        }
      }
    }
    return flipped;
  }
  return tensor;
}

const STARTPOS_BOARD_FIELD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

/**
 * Builds the full 112-plane lc0 input tensor for `fen`, optionally with real
 * prior history. `priorFens`, if given, is the game's actual position
 * history strictly before `fen`, oldest first (e.g. `[startpos, afterMove1,
 * ...]`) -- see `historyReconstruct.ts` for how the adapter decides whether
 * it has this at all (only standard games do; custom-FEN games never do,
 * since there's no way to know what came before an arbitrary FEN).
 *
 * Slot 0 is always the current position. Slots 1-7 take real prior
 * positions, most recent first, for as many as are known. Once real history
 * runs out, the OLDEST known position (real or, with no history at all, the
 * current FEN itself) is repeated for the rest -- UNLESS that oldest known
 * position is exactly the standard starting position, in which case the
 * remaining slots are left at zero. That is lc0's own `fen_only`
 * HistoryFill default, read directly from its C++ source (encoder.cc: once
 * the history index goes negative it clamps to index 0 and keeps filling,
 * breaking out -- leaving the rest zero -- only when that clamped position
 * is the literal starting board) and cross-checked against `shared_params.cc`,
 * which confirms `fen_only` is the option's actual default. This is also
 * exactly what `lczerolens`' own from-scratch `to_input_tensor` does for the
 * padding step, an independent implementation of the same rule (see
 * SPEC_maia_integrate.md's report for the verification against it).
 *
 * Every slot is expressed from the CURRENT position's mover's perspective
 * (`us`), never each historical position's own side to move -- matching
 * both lc0's alternating-mirror bookkeeping and lczerolens' simpler
 * "same `us` for every slot" approach, which are equivalent (verified
 * below). Repetition (plane 12 of each 13-plane group) is left at 0 even
 * when real history is available: genuine repetition detection needs full
 * position equality (castling rights, en passant) across that history, not
 * just piece placement, and is out of scope for this round -- see the
 * original single-FEN reasoning above, which still applies.
 */
export function boardToInputPlanes(fen: string, priorFens: readonly string[] = []): Float32Array {
  const chess = new Chess(fen);
  const us: Side = chess.turn() === "w" ? "w" : "b";
  const them: Side = us === "w" ? "b" : "w";

  const tensor = new Float32Array(112 * 8 * 8);

  // Slot order: current position, then up to 7 real prior positions
  // (most-recent-first -- `priorFens` is oldest-first, so take the last 7
  // and reverse).
  const knownFens = [fen, ...priorFens.slice(-7).reverse()];
  const oldestKnownIsStartpos = knownFens[knownFens.length - 1].split(" ")[0] === STARTPOS_BOARD_FIELD;

  for (let slot = 0; slot < 8; slot++) {
    if (slot < knownFens.length) {
      tensor.set(configTensorFromFen(knownFens[slot], us), slot * 13 * 64);
    } else if (!oldestKnownIsStartpos) {
      tensor.set(configTensorFromFen(knownFens[knownFens.length - 1], us), slot * 13 * 64);
    }
    // else: leave zero -- lc0's fen_only rule once the oldest known
    // position is the starting position.
  }

  const auxBase = 104 * 64;
  const fillPlane = (planeOffset: number, value: number) => {
    tensor.fill(value, auxBase + planeOffset * 64, auxBase + (planeOffset + 1) * 64);
  };

  const castling = fen.split(" ")[2] ?? "-";
  const usQueenside = us === "w" ? castling.includes("Q") : castling.includes("q");
  const usKingside = us === "w" ? castling.includes("K") : castling.includes("k");
  const themQueenside = them === "w" ? castling.includes("Q") : castling.includes("q");
  const themKingside = them === "w" ? castling.includes("K") : castling.includes("k");

  if (usQueenside) fillPlane(0, 1.0);
  if (usKingside) fillPlane(1, 1.0);
  if (themQueenside) fillPlane(2, 1.0);
  if (themKingside) fillPlane(3, 1.0);
  if (us === "b") fillPlane(4, 1.0); // side-to-move plane
  const halfmoveClock = Number(fen.split(" ")[4] ?? "0");
  fillPlane(5, halfmoveClock);
  // plane 6 ("zeros") intentionally left at 0.
  fillPlane(7, 1.0); // all-ones board-edge helper plane

  return tensor;
}
