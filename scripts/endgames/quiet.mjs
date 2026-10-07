// Plain-JS copy of src/services/endgames/quiet.ts's see()/isQuiet(), kept
// functionally identical (checked by quiet.test.ts) so the build/pool
// scripts and the shipped app never drift apart on what QUIET means --
// see SPEC_endgames_quiet.md. Not byte-identical to the .ts file the way
// mirror.mjs is to mirror.ts: this algorithm needs internal helper
// functions, and TypeScript's strict mode requires those to carry type
// annotations that plain JS can't have, so quiet.test.ts instead proves
// the two files agree on every capture in the shipped catalog.
import { Chess } from "chess.js";

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 1000 };

function leastValuableAttacker(board, square, color) {
  let best = null;
  for (const attackerSquare of board.attackers(square, color)) {
    const piece = board.get(attackerSquare);
    if (!piece) continue;
    const value = PIECE_VALUE[piece.type];
    if (!best || value < best.value) best = { square: attackerSquare, type: piece.type, value };
  }
  return best;
}

function exchange(board, square, side, standingValue) {
  const attacker = leastValuableAttacker(board, square, side);
  if (!attacker) return 0;

  const promotes = attacker.type === "p" && square[1] === (side === "w" ? "8" : "1");
  const placedType = promotes ? "q" : attacker.type;
  const placedValue = promotes ? PIECE_VALUE.q : attacker.value;

  board.remove(attacker.square);
  board.remove(square);
  board.put({ type: placedType, color: side }, square);

  const opponent = side === "w" ? "b" : "w";
  const gain = standingValue - exchange(board, square, opponent, placedValue);
  return Math.max(0, gain);
}

export function see(fen, move) {
  const board = new Chess(fen);
  const attacker = board.get(move.from);
  const victim = board.get(move.to);
  if (!attacker || !victim) return 0;

  const promotionRank = attacker.color === "w" ? "8" : "1";
  const promotes = attacker.type === "p" && move.to[1] === promotionRank;
  const placedType = promotes ? move.promotion ?? "q" : attacker.type;
  const placedValue = PIECE_VALUE[placedType];

  board.remove(move.from);
  board.remove(move.to);
  board.put({ type: placedType, color: attacker.color }, move.to);

  const opponent = attacker.color === "w" ? "b" : "w";
  return PIECE_VALUE[victim.type] - exchange(board, move.to, opponent, placedValue);
}

export function isQuiet(fen) {
  const board = new Chess(fen);
  const captures = board.moves({ verbose: true }).filter((m) => m.captured);
  return captures.every((m) => see(fen, { from: m.from, to: m.to, promotion: m.promotion }) < 2);
}
