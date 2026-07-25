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
    <div className="animate-fade-in mb-3 rounded-xl border border-border-active bg-bg-primary-soft p-4">
      <BoardPanel
        board={fenToBoard(fen)}
        defaultFlipped={playerColor === "b"}
        highlightFrom={lastMove?.from}
        highlightTo={lastMove?.to}
      />
    </div>
  );
}
