import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/state/gameStore";
import { getById, randomFrom, type SizeBucket } from "@/services/endgames/catalog";
import { bucketOfEntry, bucketEntries } from "@/services/endgames/catalogGroups";

interface GameOverPanelProps {
  onNewGame(): void;
  onMenu(): void;
  onEndgames(bucket: SizeBucket): void;
}

/**
 * Game's over — this is exactly when you want options, not a dead end:
 * start again, go change the level, or take the PGN. Also dismissible
 * (backdrop tap / Escape) so the move log stays reachable underneath.
 *
 * An endgame in progress (activeEndgame) swaps the whole button row for the
 * practice-mode set — decision 6 (the "Goal was a win/draw" line is gone).
 * A normal or set-up game (activeEndgame null) keeps today's panel exactly,
 * unchanged.
 */
export function GameOverPanel({ onNewGame, onMenu, onEndgames }: GameOverPanelProps) {
  const gameOverFlag = useGameStore((s) => s.gameOverFlag);
  const outcome = useGameStore((s) => s.gameOverOutcome);
  const copyPgn = useGameStore((s) => s.copyPgn);
  const activeEndgame = useGameStore((s) => s.activeEndgame);
  const startEndgame = useGameStore((s) => s.startEndgame);
  const [dismissed, setDismissed] = useState(false);

  // A new game (or a new game-over) resets the dismissal.
  useEffect(() => {
    setDismissed(false);
  }, [gameOverFlag]);

  const entry = activeEndgame ? getById(activeEndgame.id) : null;

  function playAnotherOfThisSize() {
    if (!entry) return;
    void startEndgame(randomFrom(bucketEntries(entry), entry.id).id);
  }

  return (
    <Modal open={gameOverFlag && !!outcome && !dismissed} onClose={() => setDismissed(true)}>
      <p className="mb-1 text-center text-base font-medium text-text-accent">{outcome?.text}</p>
      <div className="flex flex-col gap-2">
        {entry ? (
          <>
            <Button variant="primary" className="w-full" onClick={() => void startEndgame(entry.id)}>
              Try again
            </Button>
            <Button variant="secondary" className="w-full" onClick={playAnotherOfThisSize}>
              Another of this size
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => void copyPgn()}>
              Copy PGN
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => onEndgames(bucketOfEntry(entry))}>
              Endgames
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" className="w-full" onClick={onNewGame}>
              New Game
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => void copyPgn()}>
              Copy PGN
            </Button>
            <Button variant="secondary" className="w-full" onClick={onMenu}>
              Menu
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
