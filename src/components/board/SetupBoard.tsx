import { BoardPanel } from "./BoardPanel";
import { PieceGlyph } from "./PieceGlyph";
import type { SetupBoard as BoardMatrix } from "@/services/chess/fen";
import { cn } from "@/lib/cn";

const WHITE_PIECES = ["K", "Q", "R", "B", "N", "P"];
const BLACK_PIECES = ["k", "q", "r", "b", "n", "p"];

interface SetupBoardProps {
  board: BoardMatrix;
  flipped: boolean;
  selectedPiece: string;
  onSelectPiece(piece: string): void;
  onSquareClick(row: number, col: number): void;
}

function PaletteGroup({
  pieces,
  selectedPiece,
  onSelectPiece,
}: {
  pieces: string[];
  selectedPiece: string;
  onSelectPiece(piece: string): void;
}) {
  return (
    <div className="flex gap-1.5">
      {pieces.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelectPiece(p)}
          aria-pressed={p === selectedPiece}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-lg border transition-colors",
            p === selectedPiece
              ? "border-border-active bg-bg-primary-soft"
              : "border-border-default bg-bg-surface hover:bg-bg-surface-alt",
          )}
        >
          <PieceGlyph piece={p} />
        </button>
      ))}
    </div>
  );
}

export function SetupBoard({ board, flipped, selectedPiece, onSelectPiece, onSquareClick }: SetupBoardProps) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-4">
        <PaletteGroup pieces={WHITE_PIECES} selectedPiece={selectedPiece} onSelectPiece={onSelectPiece} />
        <PaletteGroup pieces={BLACK_PIECES} selectedPiece={selectedPiece} onSelectPiece={onSelectPiece} />
      </div>
      <BoardPanel board={board} defaultFlipped={flipped} interactive onSquareClick={onSquareClick} />
    </div>
  );
}
