// Pure logic for the `pos` command (SPEC_position_command.md Part 1): add,
// delete and list catalog entries. No I/O here -- pos.mjs owns reading and
// writing sources.json/codes.json, calling the build, and running tests.
import { Chess } from "chess.js";
import { isQuiet } from "./quiet.mjs";
import { isNearCopy } from "./nearCopy.mjs";

function normalizedFen(placement, sideToMove) {
  return `${placement} ${sideToMove} - - 0 1`;
}

function pieceCountOfPlacement(placement) {
  return placement.replace(/[^a-zA-Z]/g, "").length;
}

function codeFor(next) {
  return `E${String(next).padStart(3, "0")}`;
}

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

/**
 * Rotates a placement 180 degrees (a1<->h8, etc.): rank order reverses and
 * each rank's file order reverses with it. Pieces keep their own letter and
 * colour -- SPEC_pos_page_and_remove.md's "Flip board" uses this together
 * with reversing the view direction, so pieces stay visually put on screen
 * while the stored placement comes to match the diagram's actual side.
 */
export function rotate180(placement) {
  return placement
    .split("/")
    .reverse()
    .map((rank) => collapseRank(expandRank(rank).reverse()))
    .join("/");
}

/**
 * Validates a new position and, if it passes, returns the manifest and
 * codes with it added -- never mutates its inputs. Throws a plain-text
 * error on: illegal FEN, game already over, not quiet, or a near-copy of
 * an existing entry.
 */
export function addEntry(manifest, codes, { placement, sideToMove }) {
  const fen = normalizedFen(placement, sideToMove);

  const chess = new Chess();
  try {
    chess.load(fen);
  } catch (err) {
    throw new Error(`illegal position: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (chess.isGameOver()) throw new Error("position is already over");
  if (!isQuiet(fen)) throw new Error("position is not quiet (the side to move has a capture worth 2 pawns or more)");

  for (const entry of manifest) {
    const existingPlacement = entry.extract?.placement;
    if (existingPlacement && isNearCopy(placement, existingPlacement)) {
      throw new Error(`near-copy of an existing entry: ${entry.code}`);
    }
  }

  const code = codeFor(codes.next);
  const entry = {
    id: code.toLowerCase(),
    code,
    name: null,
    themes: [],
    extract: { kind: "fen", placement, sideToMove },
    flip: false,
  };

  return {
    manifest: [...manifest, entry],
    codes: { ...codes, next: codes.next + 1 },
    code,
  };
}

/**
 * Removes the entry with `code` and retires it -- never mutates its
 * inputs. Throws a plain-text error when the code doesn't exist.
 */
export function deleteEntry(manifest, codes, code) {
  const index = manifest.findIndex((entry) => entry.code === code);
  if (index === -1) throw new Error(`no entry with code ${code}`);

  return {
    manifest: [...manifest.slice(0, index), ...manifest.slice(index + 1)],
    codes: { ...codes, retired: [...codes.retired, code] },
  };
}

/** Rows of code, side to move, piece count -- for `pos list`. */
export function listEntries(manifest) {
  return manifest.map((entry) => ({
    code: entry.code,
    sideToMove: entry.extract.sideToMove,
    pieces: pieceCountOfPlacement(entry.extract.placement),
  }));
}
