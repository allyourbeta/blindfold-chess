import { FlipVertical2 } from "lucide-react";
import { Board } from "./Board";
import type { SetupBoard as BoardMatrix } from "@/services/chess/fen";
import { useSettingsStore } from "@/state/settingsStore";

interface BoardPanelProps {
  /** Lets a caller that has already sized its own wrapper (the peek overlay) lift the board's default width cap. */
  boardClassName?: string;
  board: BoardMatrix;
  /** Orientation to use until the player rotates it themselves. */
  defaultFlipped: boolean;
  highlightFrom?: string | null;
  highlightTo?: string | null;
  interactive?: boolean;
  onSquareClick?(row: number, col: number): void;
}

/**
 * A board plus its rotate control. Every board in the app goes through here so
 * the orientation is always adjustable and always consistent — a rotation on
 * the setup board carries over to a peek, and vice versa.
 *
 * The wrapper is `w-full` deliberately: a centred flex column shrinks to fit
 * its contents, and the board's squares are percentage-width, so without a
 * definite width from above the board collapses to whatever it happens to
 * contain — which is nothing once the setup board is cleared.
 */
export function BoardPanel({
  boardClassName,
  board,
  defaultFlipped,
  highlightFrom,
  highlightTo,
  interactive,
  onSquareClick,
}: BoardPanelProps) {
  const override = useSettingsStore((s) => s.boardFlipOverride);
  const toggleBoardFlip = useSettingsStore((s) => s.toggleBoardFlip);
  const flipped = override ?? defaultFlipped;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Board
        className={boardClassName}
        board={board}
        flipped={flipped}
        highlightFrom={highlightFrom}
        highlightTo={highlightTo}
        interactive={interactive}
        onSquareClick={onSquareClick}
      />
      <button
        type="button"
        onClick={() => toggleBoardFlip(defaultFlipped)}
        aria-label="Rotate the board 180 degrees"
        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-text-secondary hover:bg-bg-surface-alt"
      >
        <FlipVertical2 className="h-4 w-4" />
        {flipped ? "Black's view" : "White's view"}
      </button>
    </div>
  );
}
