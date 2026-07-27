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
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-2 flex items-center justify-between border-b border-border-default pb-2 shortscape:mb-1 shortscape:pb-1">
        <button onClick={handleMenu} aria-label="Back to menu" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-bg-surface-alt">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-3xl font-extrabold tracking-widest text-text-accent shortscape:text-xl">MIND'S EYE</div>
        <div className="h-11 w-11" aria-hidden />
      </div>

      {/*
        Portrait: one column, the original stack, in DOM order. Short
        landscape: the SAME elements placed into two grid columns —
        reading and controls on the left, keypad on the right where it
        gets more width than portrait ever gave it. Explicit placement
        (rather than reordering the markup) keeps portrait's source order
        authoritative: keypad above the action buttons.
      */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)_auto_auto] overflow-hidden shortscape:grid-cols-2 shortscape:grid-rows-[auto_auto_minmax(0,1fr)_auto] shortscape:gap-x-4">
        <div className="shortscape:col-start-1 shortscape:row-start-1">
          <StatusLine />
        </div>
        <div className="mt-2 shortscape:col-start-1 shortscape:row-start-2 shortscape:mt-1">
          <PeekPanel />
          <MoveList />
        </div>
        <div className="flex min-h-0 flex-col shortscape:col-start-1 shortscape:row-start-3">
          <MessageLog />
        </div>
        <div className="pt-1 shortscape:col-start-2 shortscape:row-span-4 shortscape:row-start-1 shortscape:self-center shortscape:pt-0">
          <MoveKeypad />
        </div>
        <div className="mt-2 shortscape:col-start-1 shortscape:row-start-4 shortscape:mt-0">
          <ActionBar />
        </div>
      </div>

      <GameOverPanel onNewGame={() => void handleNewGame()} onMenu={handleMenu} />
    </div>
  );
}
