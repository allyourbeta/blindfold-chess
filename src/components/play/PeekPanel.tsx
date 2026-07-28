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
      One treatment in both orientations. Portrait used to render an inline
      amber panel that shoved the layout around; landscape got a centred
      overlay when it was fixed. Two designs for one feature, for no reason
      other than the order they were built in. This is the landscape one,
      everywhere: the peek is a three-second reveal, so nothing underneath
      needs to stay interactive while it's up.

      `pointer-events-none`: the overlay is purely visual. Covering the
      screen with a live layer would swallow taps meant for the controls
      underneath — including a second Peek tap, which the app deliberately
      treats as part of the same peek rather than a new one.
    */
    <div className="animate-fade-in pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-bg-base/95 p-4">
      <div className="w-[min(92vw,calc(100dvh-7rem))]">
        <BoardPanel
          boardClassName="max-w-none"
          board={fenToBoard(fen)}
          defaultFlipped={playerColor === "b"}
          highlightFrom={lastMove?.from}
          highlightTo={lastMove?.to}
        />
      </div>
    </div>
  );
}
