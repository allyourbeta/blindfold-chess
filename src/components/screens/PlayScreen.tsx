import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { StatusLine } from "@/components/play/StatusLine";
import { PeekPanel } from "@/components/play/PeekPanel";
import { MoveList } from "@/components/play/MoveList";
import { MessageLog } from "@/components/play/MessageLog";
import { MoveKeypad } from "@/components/play/MoveKeypad";
import { ActionBar } from "@/components/play/ActionBar";
import { GameOverPanel } from "@/components/play/GameOverPanel";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/state/gameStore";
import { useSpeechOutput, unlockAudioOutput, resetSpeechQueue } from "@/hooks/useSpeechOutput";
import type { SizeBucket } from "@/services/endgames/catalog";

interface PlayScreenProps {
  onMenu(): void;
  onEndgames(bucket: SizeBucket): void;
}

export function PlayScreen({ onMenu, onEndgames }: PlayScreenProps) {
  useSpeechOutput();
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const gameOverFlag = useGameStore((s) => s.gameOverFlag);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  // Leaving a game, by any route, must not leave a move still being spoken
  // behind — the engine's reply can still be mid-announcement when the
  // player taps away.
  function leaveCurrentGame() {
    returnToMenu();
    resetSpeechQueue();
  }

  function handleMenu() {
    leaveCurrentGame();
    onMenu();
  }

  function handleBack() {
    if (gameOverFlag) {
      handleMenu();
      return;
    }
    setLeaveConfirmOpen(true);
  }

  function handleEndgames(bucket: SizeBucket) {
    leaveCurrentGame();
    onEndgames(bucket);
  }

  async function handleNewGame() {
    unlockAudioOutput();
    await startNewGame();
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="mb-2 flex items-center justify-between border-b border-border-default pb-2 shortscape:mb-1 shortscape:pb-1">
        <button onClick={handleBack} aria-label="Back to menu" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-bg-surface-alt">
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
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)_auto_auto] overflow-hidden shortscape:grid-cols-[3fr_2fr] shortscape:grid-rows-[auto_auto_minmax(3.5rem,1fr)_auto] shortscape:gap-x-4">
        <div className="shortscape:col-start-1 shortscape:row-start-1">
          <StatusLine />
        </div>
        <div className="mt-2 shortscape:col-start-1 shortscape:row-start-2 shortscape:mt-1">
          <PeekPanel />
          <MoveList />
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden shortscape:col-start-1 shortscape:row-start-3">
          <MessageLog />
        </div>
        <div className="min-w-0 pt-1 shortscape:col-start-2 shortscape:row-span-4 shortscape:row-start-1 shortscape:self-center shortscape:pt-0">
          <MoveKeypad />
        </div>
        <div className="mt-2 min-w-0 shortscape:col-start-1 shortscape:row-start-4 shortscape:mt-0">
          <ActionBar />
        </div>
      </div>

      <GameOverPanel onNewGame={() => void handleNewGame()} onMenu={handleMenu} onEndgames={handleEndgames} />

      <Modal open={leaveConfirmOpen} onClose={() => setLeaveConfirmOpen(false)}>
        <p className="text-center text-base font-semibold text-text-primary">Leave this game?</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setLeaveConfirmOpen(false)}>
            Stay
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleMenu}>
            Leave
          </Button>
        </div>
      </Modal>
    </div>
  );
}
