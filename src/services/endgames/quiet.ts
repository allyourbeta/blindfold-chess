import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

/**
 * Standard chess-programming piece values for exchange evaluation. The king
 * is given a value far above a queen's so it is only ever picked as the
 * "least valuable attacker" once nothing else can recapture -- see
 * SPEC_endgames_quiet.md's "king last" rule.
 */
const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 1000 };

export interface CaptureMove {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

interface Attacker {
  square: Square;
  type: PieceSymbol;
  value: number;
}

function leastValuableAttacker(board: Chess, square: Square, color: Color): Attacker | null {
  let best: Attacker | null = null;
  for (const attackerSquare of board.attackers(square, color)) {
    const piece = board.get(attackerSquare);
    if (!piece) continue;
    const value = PIECE_VALUE[piece.type];
    if (!best || value < best.value) best = { square: attackerSquare, type: piece.type, value };
  }
  return best;
}

/**
 * Plays out the rest of the swap list on `square` for `side`, each side
 * recapturing with its least valuable attacker and always free to stop
 * early (the `Math.max(0, ...)` below) once continuing stops paying off.
 * `standingValue` is the value of whatever piece currently sits on `square`
 * -- the thing `side`'s attacker would capture next.
 */
function exchange(board: Chess, square: Square, side: Color, standingValue: number): number {
  const attacker = leastValuableAttacker(board, square, side);
  if (!attacker) return 0;

  const promotes = attacker.type === "p" && square[1] === (side === "w" ? "8" : "1");
  const placedType: PieceSymbol = promotes ? "q" : attacker.type;
  const placedValue = promotes ? PIECE_VALUE.q : attacker.value;

  board.remove(attacker.square);
  board.remove(square);
  board.put({ type: placedType, color: side }, square);

  const opponent: Color = side === "w" ? "b" : "w";
  const gain = standingValue - exchange(board, square, opponent, placedValue);
  return Math.max(0, gain);
}

/**
 * Static exchange evaluation for one specific capture `move`, in pawns of
 * material gained by the side making it, assuming both sides then
 * recapture with their least valuable attacker first (real swap list, not
 * a one-step check) and either side can stop the exchange early. Returns 0
 * if `move` is not a capture.
 */
export function see(fen: string, move: CaptureMove): number {
  const board = new Chess(fen);
  const attacker = board.get(move.from);
  const victim = board.get(move.to);
  if (!attacker || !victim) return 0;

  const promotionRank = attacker.color === "w" ? "8" : "1";
  const promotes = attacker.type === "p" && move.to[1] === promotionRank;
  const placedType: PieceSymbol = promotes ? move.promotion ?? "q" : attacker.type;
  const placedValue = PIECE_VALUE[placedType];

  board.remove(move.from);
  board.remove(move.to);
  board.put({ type: placedType, color: attacker.color }, move.to);

  const opponent: Color = attacker.color === "w" ? "b" : "w";
  return PIECE_VALUE[victim.type] - exchange(board, move.to, opponent, placedValue);
}

/**
 * QUIET means the side to move has no capture with a static exchange
 * evaluation of +2 or more -- see SPEC_endgames_quiet.md.
 */
export function isQuiet(fen: string): boolean {
  const board = new Chess(fen);
  const captures = board.moves({ verbose: true }).filter((m) => m.captured);
  return captures.every((m) => see(fen, { from: m.from, to: m.to, promotion: m.promotion as PieceSymbol | undefined }) < 2);
}
