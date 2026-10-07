/**
 * Flips a FEN's placement top-to-bottom (rank 8 <-> rank 1, etc.), swaps
 * every piece's colour, and swaps the side to move. Files never change.
 * Used as a last resort to balance Black-to-move positions across size
 * buckets -- see SPEC_endgames_catalog.md decisions.
 *
 * Kept byte-identical to scripts/endgames/mirror.mjs (checked by
 * mirror.test.ts) so the build script and the app never drift apart.
 */
export function mirrorColors(fen: string): string {
  const [placement, turn, castling, ep, halfmove, fullmove] = fen.trim().split(/\s+/);
  const ranks = placement.split("/");
  const flippedRanks = [...ranks].reverse().map((rank) =>
    rank.replace(/[a-zA-Z]/g, (ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())),
  );
  const newTurn = turn === "w" ? "b" : "w";
  return [flippedRanks.join("/"), newTurn, castling ?? "-", ep ?? "-", halfmove ?? "0", fullmove ?? "1"].join(" ");
}
