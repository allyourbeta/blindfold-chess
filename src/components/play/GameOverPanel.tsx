import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/state/gameStore";

export function GameOverPanel({ onNewGame }: { onNewGame(): void }) {
  const gameOverFlag = useGameStore((s) => s.gameOverFlag);
  const outcome = useGameStore((s) => s.gameOverOutcome);

  return (
    <Modal open={gameOverFlag && !!outcome}>
      <p className="mb-4 text-center text-base font-medium text-text-accent">{outcome?.text}</p>
      <Button variant="primary" className="w-full" onClick={onNewGame}>
        New Game
      </Button>
    </Modal>
  );
}
