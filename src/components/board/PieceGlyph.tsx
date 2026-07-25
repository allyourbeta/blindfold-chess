/**
 * Board pieces are the cburnett SVG set — the same pieces the original app
 * used, but vendored into public/pieces/ instead of pulled from GitHub at
 * runtime, so they survive offline. Unicode chess characters were tried and
 * abandoned: the white pieces are hollow outlines and disappear on a light
 * board, and every platform renders them differently.
 *
 * Set by Colin M. L. Burnett, CC BY-SA 3.0 — see README for attribution.
 */

const PIECE_FILES: Record<string, string> = {
  K: "wK",
  Q: "wQ",
  R: "wR",
  B: "wB",
  N: "wN",
  P: "wP",
  k: "bK",
  q: "bQ",
  r: "bR",
  b: "bB",
  n: "bN",
  p: "bP",
};

const PIECE_NAMES: Record<string, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};

function describe(piece: string): string {
  const colour = piece === piece.toUpperCase() ? "white" : "black";
  return `${colour} ${PIECE_NAMES[piece.toLowerCase()] ?? "piece"}`;
}

export function PieceGlyph({ piece }: { piece: string }) {
  const file = PIECE_FILES[piece];
  if (!file) return null;
  return (
    <img
      src={`/pieces/${file}.svg`}
      alt={describe(piece)}
      draggable={false}
      className="pointer-events-none h-[85%] w-[85%] select-none object-contain"
    />
  );
}
