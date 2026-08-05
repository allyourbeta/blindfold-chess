import { Square } from "./Square";
import type { SetupBoard as BoardMatrix } from "@/services/chess/fen";
import { FILES } from "@/services/chess/fen";
import { cn } from "@/lib/cn";

interface BoardProps {
  board: BoardMatrix;
  flipped: boolean;
  highlightFrom?: string | null;
  highlightTo?: string | null;
  interactive?: boolean;
  onSquareClick?(row: number, col: number): void;
  className?: string;
}

const INDICES = [0, 1, 2, 3, 4, 5, 6, 7];

export function Board({
  board,
  flipped,
  highlightFrom = null,
  highlightTo = null,
  interactive = false,
  onSquareClick,
  className,
}: BoardProps) {
  const rows = flipped ? [...INDICES].reverse() : INDICES;
  const cols = flipped ? [...INDICES].reverse() : INDICES;

  return (
    <div
      className={cn(
        // Squares are percentage-width, so the board MUST have a definite
        // width of its own — with only `w-full` inside a shrink-to-fit
        // parent the size collapses to whatever the contents imply, which
        // is nothing once the setup board is cleared. Callers that have
        // already sized their own wrapper (the peek overlay) pass
        // `max-w-none`; everyone else keeps this cap.
        "mx-auto w-full min-w-[16rem] max-w-[400px] select-none",
        className,
      )}
    >
      <div className="flex overflow-hidden rounded-lg border-2 border-stone-700 dark:border-stone-500">
        {/* Coordinate gutter widened from w-5 so the labels can carry a
            readable size — they were text-[10px], the smallest type in the
            app, on a board you only get to look at for three seconds. */}
        <div className="flex w-6 flex-col">
          {rows.map((r) => (
            <div key={r} className="flex flex-1 items-center justify-center font-mono text-sm text-text-secondary">
              {8 - r}
            </div>
          ))}
        </div>
        <div className="flex-1">
          {rows.map((r) => (
            <div key={r} className="flex">
              {cols.map((c) => {
                const squareName = FILES[c] + (8 - r);
                return (
                  <Square
                    key={c}
                    piece={board[r][c]}
                    light={(r + c) % 2 === 0}
                    highlighted={squareName === highlightFrom || squareName === highlightTo}
                    interactive={interactive}
                    onClick={() => onSquareClick?.(r, c)}
                    square={squareName}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex pl-6">
        {cols.map((c) => (
          <div key={c} className="w-[12.5%] text-center font-mono text-sm text-text-secondary">
            {FILES[c]}
          </div>
        ))}
      </div>
    </div>
  );
}
