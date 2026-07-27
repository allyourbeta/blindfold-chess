import { useGameStore } from "@/state/gameStore";
import { BoardPanel } from "@/components/board/BoardPanel";
import { fenToBoard } from "@/services/chess/fen";

export function PeekPanel() {
  const isPeeking = useGameStore((s) => s.isPeeking);
  const fen = useGameStore((s) => s.fen);
  const playerColor = useGameStore((s) => s.playerColor);
  const lastMove = useGameStore((s) => s.lastMove);

  if (!isPeeking) return null;

  return (
    /*
      Portrait: an inline panel in the column, as before. Short landscape:
      there is no vertical room for a board AND the controls, so the peek
      becomes a centred overlay instead of shoving the layout apart. It's a
      three-second reveal either way — nothing underneath needs to be
      interactive while it's up.
    */
    <div className="animate-fade-in mb-3 rounded-xl border border-border-active bg-bg-primary-soft p-4 shortscape:fixed shortscape:inset-0 shortscape:z-40 shortscape:m-0 shortscape:flex shortscape:items-center shortscape:justify-center shortscape:rounded-none shortscape:border-0 shortscape:bg-bg-base/95 shortscape:p-2">
      <BoardPanel
        board={fenToBoard(fen)}
        defaultFlipped={playerColor === "b"}
        highlightFrom={lastMove?.from}
        highlightTo={lastMove?.to}
      />
    </div>
  );
}
