// Small, self-contained copies of the pure helpers from
// src/services/endgames/catalog.ts, used only to balance the catalog while
// curating it offline. The shipped app's own copies are the authority at
// runtime; these exist so curate.mjs can reason about buckets, families and
// material keys before src/data/endgames.json even exists.
import { Chess } from "chess.js";

const PIECE_VALUE = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const PIECE_RANK = ["q", "r", "b", "n", "p"];

export const SIZE_BUCKETS = [
  { min: 3, max: 5, label: "3 to 5 pieces" },
  { min: 6, max: 8, label: "6 to 8 pieces" },
  { min: 9, max: 11, label: "9 to 11 pieces" },
  { min: 12, max: 16, label: "12 to 16 pieces" },
];

export function pieceCount(fen) {
  return new Chess(fen).board().flat().filter((sq) => sq !== null).length;
}

export function bucketFor(count) {
  return SIZE_BUCKETS.find((b) => count >= b.min && count <= b.max) ?? null;
}

function sideMaterial(fen) {
  const [placement] = fen.split(" ");
  const white = {};
  const black = {};
  for (const ch of placement) {
    if (!/[a-zA-Z]/.test(ch)) continue;
    const lower = ch.toLowerCase();
    const bucket = ch === ch.toUpperCase() ? white : black;
    bucket[lower] = (bucket[lower] ?? 0) + 1;
  }
  return { white, black };
}

function materialValue(side) {
  return PIECE_RANK.reduce((sum, p) => sum + (PIECE_VALUE[p] ?? 0) * (side[p] ?? 0), 0);
}

function sideKey(side) {
  let key = "K";
  for (const p of PIECE_RANK) key += p.toUpperCase().repeat(side[p] ?? 0);
  return key;
}

export function materialKey(fen) {
  const { white, black } = sideMaterial(fen);
  const whiteFirst = materialValue(white) >= materialValue(black);
  return `${sideKey(whiteFirst ? white : black)}v${sideKey(whiteFirst ? black : white)}`;
}

export function family(key) {
  const letters = new Set();
  for (const ch of key) {
    if (ch === "v" || ch === "K" || ch === "P") continue;
    letters.add(ch.toLowerCase());
  }
  if (letters.size === 0) return "pawn";
  if (letters.size === 1 && letters.has("r")) return "rook";
  if (letters.size === 1 && letters.has("q")) return "queen";
  if ([...letters].every((l) => l === "b" || l === "n")) return "minor";
  return "mixed";
}

/** Normalizes a placement+side into the catalog's canonical FEN shape. */
export function toCanonicalFen(placement, sideToMove) {
  return `${placement} ${sideToMove} - - 0 1`;
}

function placementRanks(placement) {
  return placement.split("/");
}

function shiftFile(placement, by) {
  // Shifts every piece `by` files; squares that fall off the board become empty.
  // Only meaningful for by in [-7,7]; used solely for the file-shift near-copy check.
  const expand = (rank) => {
    const squares = [];
    for (const ch of rank) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) squares.push(null);
      else squares.push(ch);
    }
    return squares;
  };
  const collapse = (squares) => {
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
  };
  return placementRanks(placement)
    .map((rank) => {
      const squares = expand(rank);
      const shifted = new Array(8).fill(null);
      for (let i = 0; i < 8; i++) {
        const j = i + by;
        if (j >= 0 && j < 8) shifted[j] = squares[i];
      }
      return collapse(shifted);
    })
    .join("/");
}

function mirrorFiles(placement) {
  return placementRanks(placement)
    .map((rank) => {
      const expand = [];
      for (const ch of rank) {
        if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) expand.push(null);
        else expand.push(ch);
      }
      expand.reverse();
      let out = "";
      let empties = 0;
      for (const sq of expand) {
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
    })
    .join("/");
}

function colorMirrorPlacement(placement) {
  return placementRanks(placement)
    .reverse()
    .map((rank) => rank.replace(/[a-zA-Z]/g, (ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())))
    .join("/");
}

/** True if `a` and `b` are the same position up to a file shift, a left-right mirror, or a colour mirror. */
export function isNearCopy(a, b) {
  if (a === b) return true;
  for (let shift = -7; shift <= 7; shift++) {
    if (shift !== 0 && shiftFile(a, shift) === b) return true;
  }
  if (mirrorFiles(a) === b) return true;
  if (colorMirrorPlacement(a) === b) return true;
  return false;
}
