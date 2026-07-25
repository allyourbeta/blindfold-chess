import { validateFen as chessValidateFen } from "chess.js";

export const FILES = "abcdefgh";

export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** 8x8 array, row 0 = rank 8, col 0 = file a. Cell values match PIECES_UNICODE keys. */
export type SetupBoard = (string | null)[][];

export function fenToBoard(fen: string): SetupBoard {
  const rows = fen.split(" ")[0].split("/");
  const board: SetupBoard = [];
  for (let r = 0; r < 8; r++) {
    board[r] = [];
    let c = 0;
    for (const ch of rows[r]) {
      if ("12345678".includes(ch)) {
        for (let x = 0; x < parseInt(ch, 10); x++) board[r][c++] = null;
      } else {
        board[r][c++] = ch;
      }
    }
  }
  return board;
}

/**
 * Drops castling rights that are impossible for the given board position
 * — e.g. a right that assumes a rook that isn't actually on its home
 * square. Deliberate bug fix from the original app; keep this behaviour.
 */
export function sanitizeCastlingRights(board: SetupBoard, rights: string): string {
  const available = rights === "-" ? "" : rights;
  let valid = "";
  if (available.includes("K") && board[7][4] === "K" && board[7][7] === "R") valid += "K";
  if (available.includes("Q") && board[7][4] === "K" && board[7][0] === "R") valid += "Q";
  if (available.includes("k") && board[0][4] === "k" && board[0][7] === "r") valid += "k";
  if (available.includes("q") && board[0][4] === "k" && board[0][0] === "r") valid += "q";
  return valid || "-";
}

export function boardToFEN(
  board: SetupBoard,
  turn: "w" | "b",
  castlingRights: string,
  enPassant: string,
  halfmove: number,
  fullmove: number,
): string {
  let fen = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      if (board[r][c]) {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        fen += board[r][c];
      } else {
        empty++;
      }
    }
    if (empty > 0) fen += empty;
    if (r < 7) fen += "/";
  }
  const castling = sanitizeCastlingRights(board, castlingRights);
  return `${fen} ${turn} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
}

/**
 * Throws with a human-readable message if the FEN is structurally invalid
 * or doesn't have exactly one king per side. Delegates to chess.js's own
 * validator, which already enforces both.
 */
export function validateFen(fen: string): void {
  const { ok, error } = chessValidateFen(fen);
  if (!ok) throw new Error(error ?? "Invalid FEN");
}
