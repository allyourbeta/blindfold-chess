import { PieceGlyph } from "./PieceGlyph";
import { fenToBoard } from "@/services/chess/fen";
import { cn } from "@/lib/cn";

interface MiniBoardProps {
  fen: string;
  flipped: boolean;
  className?: string;
}

const INDICES = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * A plain, non-interactive board for a list of positions -- same squares
 * and piece set as `Board`, no labels, never clickable. `min-w-0`/`min-h-0`
 * on every cell so a cell never grows past its 1/8th share: without it a
 * piece glyph's own intrinsic size can stretch its cell (and so the whole
 * grid) off-square inside a flex/grid ancestor.
 */
export function MiniBoard({ fen, flipped, className }: MiniBoardProps) {
  const board = fenToBoard(fen);
  const rows = flipped ? [...INDICES].reverse() : INDICES;
  const cols = flipped ? [...INDICES].reverse() : INDICES;

  return (
    <div
      aria-hidden="true"
      data-testid="mini-board"
      className={cn(
        "grid aspect-square w-full select-none overflow-hidden rounded-md border-2 border-stone-700 dark:border-stone-500",
        className,
      )}
      style={{ gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(8, 1fr)" }}
    >
      {rows.map((r) =>
        cols.map((c) => {
          const piece = board[r][c];
          return (
            <div
              key={`${r}-${c}`}
              className={cn(
                "flex min-h-0 min-w-0 items-center justify-center overflow-hidden",
                (r + c) % 2 === 0 ? "bg-sq-light" : "bg-sq-dark",
              )}
            >
              {piece && <PieceGlyph piece={piece} />}
            </div>
          );
        }),
      )}
    </div>
  );
}
