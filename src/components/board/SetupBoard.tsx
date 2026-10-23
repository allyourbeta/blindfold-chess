import { BoardPanel } from "./BoardPanel";
import { PieceGlyph } from "./PieceGlyph";
import type { SetupBoard as BoardMatrix } from "@/services/chess/fen";
import { cn } from "@/lib/cn";

const WHITE_PIECES = ["K", "Q", "R", "B", "N", "P"];
const BLACK_PIECES = ["k", "q", "r", "b", "n", "p"];

interface SetupBoardProps {
  board: BoardMatrix;
  flipped: boolean;
  selectedPiece: string | null;
  onSelectPiece(piece: string): void;
  onSquareClick(row: number, col: number): void;
}

function PaletteGroup({
  pieces,
  selectedPiece,
  onSelectPiece,
}: {
  pieces: string[];
  selectedPiece: string | null;
  onSelectPiece(piece: string): void;
}) {
  return (
    <div className="flex w-full gap-1.5">
      {pieces.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelectPiece(p)}
          aria-pressed={p === selectedPiece}
          className={cn(
            "raised flex h-11 flex-1 items-center justify-center rounded-xl transition-colors",
            p === selectedPiece && "outline outline-[2.5px] outline-offset-1 outline-text-accent",
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
    <div className="mx-auto flex w-full min-w-[16rem] max-w-[400px] flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <PaletteGroup pieces={WHITE_PIECES} selectedPiece={selectedPiece} onSelectPiece={onSelectPiece} />
        <PaletteGroup pieces={BLACK_PIECES} selectedPiece={selectedPiece} onSelectPiece={onSelectPiece} />
      </div>
      <BoardPanel board={board} defaultFlipped={flipped} interactive onSquareClick={onSquareClick} showRotate={false} />
    </div>
  );
}
