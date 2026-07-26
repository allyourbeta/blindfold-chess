import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/state/gameStore";

/**
 * Game's over — this is exactly when you want options, not a dead end:
 * start again, go change the level, or take the PGN. Also dismissible
 * (backdrop tap / Escape) so the move log stays reachable underneath.
 */
export function GameOverPanel({ onNewGame, onMenu }: { onNewGame(): void; onMenu(): void }) {
  const gameOverFlag = useGameStore((s) => s.gameOverFlag);
  const outcome = useGameStore((s) => s.gameOverOutcome);
  const copyPgn = useGameStore((s) => s.copyPgn);
  const [dismissed, setDismissed] = useState(false);

  // A new game (or a new game-over) resets the dismissal.
  useEffect(() => {
    setDismissed(false);
  }, [gameOverFlag]);

  return (
    <Modal open={gameOverFlag && !!outcome && !dismissed} onClose={() => setDismissed(true)}>
      <p className="mb-4 text-center text-base font-medium text-text-accent">{outcome?.text}</p>
      <div className="flex flex-col gap-2">
        <Button variant="primary" className="w-full" onClick={onNewGame}>
          New Game
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => void copyPgn()}>
          Copy PGN
        </Button>
        <Button variant="secondary" className="w-full" onClick={onMenu}>
          Menu
        </Button>
      </div>
    </Modal>
  );
}
