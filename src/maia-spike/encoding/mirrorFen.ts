/**
 * Colour-mirror transform for FEN strings and UCI moves: flip ranks, swap
 * piece colours, swap castling rights, mirror the en-passant square.
 *
 * This is plain, unambiguous FEN string manipulation (no plane order or
 * board orientation judgement calls), written directly rather than ported.
 * It exists only to drive the colour-mirror symmetry gate.
 */

function swapCaseRow(row: string): string {
  let out = "";
  for (const ch of row) {
    if (ch >= "A" && ch <= "Z") out += ch.toLowerCase();
    else if (ch >= "a" && ch <= "z") out += ch.toUpperCase();
    else out += ch; // digits (empty-square counts)
  }
  return out;
}

const CASTLING_SWAP: Record<string, string> = { K: "k", Q: "q", k: "K", q: "Q" };
const CASTLING_ORDER = "KQkq";

function mirrorCastling(castling: string): string {
  if (castling === "-") return "-";
  const swapped = new Set(castling.split("").map((c) => CASTLING_SWAP[c]));
  const out = CASTLING_ORDER.split("")
    .filter((c) => swapped.has(c))
    .join("");
  return out || "-";
}

function mirrorSquare(square: string): string {
  return square[0] + String(9 - Number(square[1]));
}

export function mirrorFen(fen: string): string {
  const [board, turn, castling, ep, halfmove, fullmove] = fen.split(" ");
  const mirroredBoard = board
    .split("/")
    .reverse()
    .map(swapCaseRow)
    .join("/");
  const mirroredTurn = turn === "w" ? "b" : "w";
  const mirroredCastling = mirrorCastling(castling);
  const mirroredEp = ep === "-" ? "-" : mirrorSquare(ep);
  return `${mirroredBoard} ${mirroredTurn} ${mirroredCastling} ${mirroredEp} ${halfmove} ${fullmove}`;
}

export function mirrorUci(uci: string): string {
  const from = mirrorSquare(uci.slice(0, 2));
  const to = mirrorSquare(uci.slice(2, 4));
  return from + to + uci.slice(4);
}
