/**
 * Board pieces are the Staunty SVG set, vendored into public/pieces/ rather
 * than fetched at runtime so they survive offline. Staunty replaced cburnett
 * because its heavier outlines and solid shapes stay legible at small sizes —
 * on a peek board and on the keypad keys, cburnett's thin white outlines
 * washed out against pale backgrounds. Unicode chess characters were tried
 * long before either and abandoned: every platform renders them differently.
 *
 * Staunty by sadsnake1 (via lila / cm-chessboard), CC BY-NC-SA 4.0 — see
 * CREDITS.md. Extracted from cm-chessboard's sprite into twelve standalone
 * files so nothing depends on cross-file SVG <use>, which Safari handles
 * unreliably.
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
