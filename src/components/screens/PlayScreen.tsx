import { ArrowLeft } from "lucide-react";
import { StatusLine } from "@/components/play/StatusLine";
import { PeekPanel } from "@/components/play/PeekPanel";
import { MoveList } from "@/components/play/MoveList";
import { MessageLog } from "@/components/play/MessageLog";
import { MoveKeypad } from "@/components/play/MoveKeypad";
import { ActionBar } from "@/components/play/ActionBar";
import { GameOverPanel } from "@/components/play/GameOverPanel";
import { useGameStore } from "@/state/gameStore";
import { useSpeechOutput, unlockAudioOutput } from "@/hooks/useSpeechOutput";

export function PlayScreen({ onMenu }: { onMenu(): void }) {
  useSpeechOutput();
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const startNewGame = useGameStore((s) => s.startNewGame);

  function handleMenu() {
    returnToMenu();
    onMenu();
  }

  async function handleNewGame() {
    unlockAudioOutput();
    await startNewGame();
  }

  return (
    <div className="flex h-full w-full flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-2 flex items-center justify-between border-b border-border-default pb-2">
        <button onClick={handleMenu} aria-label="Back to menu" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-bg-surface-alt">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-3xl font-extrabold tracking-widest text-text-accent">MIND'S EYE</div>
        <div className="h-11 w-11" aria-hidden />
      </div>

      <StatusLine />
      <div className="mt-2">
        <PeekPanel />
        <MoveList />
      </div>
      <MessageLog />
      <div className="flex flex-col gap-2 pt-1">
        <MoveKeypad />
        <ActionBar />
      </div>
      <GameOverPanel onNewGame={() => void handleNewGame()} onMenu={handleMenu} />
    </div>
  );
}
