// Near-copy detection for FEN placements: identical, file-shifted, left-right
// mirrored, or colour-mirrored. Shared by the shipped-catalog invariant test
// (src/services/endgames/catalogShipped.test.ts) and the pos command
// (positions.mjs) so there is exactly one copy of this rule.
import { mirrorColors } from "./mirror.mjs";

function expandRank(rank) {
  const squares = [];
  for (const ch of rank) {
    if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) squares.push(null);
    else squares.push(ch);
  }
  return squares;
}

function collapseRank(squares) {
  let out = "";
  let empties = 0;
  for (const sq of squares) {
    if (sq === null) empties++;
    else {
      if (empties) {
        out += empties;
        empties = 0;
      }
      out += sq;
    }
  }
  if (empties) out += empties;
  return out || "8";
}

function shiftFiles(placement, by) {
  return placement
    .split("/")
    .map((rank) => {
      const squares = expandRank(rank);
      const shifted = new Array(8).fill(null);
      for (let i = 0; i < 8; i++) {
        const j = i + by;
        if (j >= 0 && j < 8) shifted[j] = squares[i];
      }
      return collapseRank(shifted);
    })
    .join("/");
}

function mirrorFilesOf(placement) {
  return placement
    .split("/")
    .map((rank) => collapseRank(expandRank(rank).reverse()))
    .join("/");
}

/** True if `a` and `b` are the same placement up to a file shift, a left-right mirror, or a colour mirror. */
export function isNearCopy(a, b) {
  if (a === b) return true;
  for (let shift = -7; shift <= 7; shift++) {
    if (shift !== 0 && shiftFiles(a, shift) === b) return true;
  }
  if (mirrorFilesOf(a) === b) return true;
  if (mirrorColors(`${a} w - - 0 1`).split(" ")[0] === b) return true;
  return false;
}
