import { ArrowLeft, Mic } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusLine } from "@/components/play/StatusLine";
import { PeekPanel } from "@/components/play/PeekPanel";
import { MoveList } from "@/components/play/MoveList";
import { MessageLog } from "@/components/play/MessageLog";
import { MoveInput } from "@/components/play/MoveInput";
import { ActionBar } from "@/components/play/ActionBar";
import { GameOverPanel } from "@/components/play/GameOverPanel";
import { useGameStore } from "@/state/gameStore";
import { useSpeechOutput, unlockAudioOutput } from "@/hooks/useSpeechOutput";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

export function PlayScreen({ onMenu }: { onMenu(): void }) {
  useSpeechOutput();
  const speech = useSpeechRecognition();
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

  const micControl =
    speech.mode === "continuous" ? (
      <Button
        type="button"
        size="icon"
        className="h-12 w-12 shrink-0"
        variant={speech.isListening ? "primary" : "secondary"}
        active={speech.isListening}
        onClick={speech.toggleListening}
        aria-label={speech.isListening ? "Stop listening" : "Start listening"}
      >
        {/* Always a plain mic — a crossed-out mic reads as "unavailable",
            not "tap to start". Listening state shows through the variant. */}
        <Mic className="h-5 w-5" />
      </Button>
    ) : speech.mode === "push-to-talk" ? (
      <Button
        type="button"
        size="icon"
        className="h-12 w-12 shrink-0"
        variant={speech.isListening ? "primary" : "secondary"}
        active={speech.isListening}
        onPointerDown={speech.startPushToTalk}
        onPointerUp={speech.stopPushToTalk}
        onPointerLeave={speech.stopPushToTalk}
        aria-label="Hold to speak a move"
      >
        <Mic className="h-5 w-5" />
      </Button>
    ) : null;

  return (
    <div className="flex h-full w-full flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-3 flex items-center justify-between border-b border-border-default pb-3">
        <button onClick={handleMenu} aria-label="Back to menu" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-bg-surface-alt">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-base font-extrabold tracking-widest text-text-accent">BLINDFOLD</div>
        <div className="h-11 w-11" aria-hidden />
      </div>

      {speech.mode === "unsupported" && (
        <p className="mb-2 text-center text-xs text-text-muted">
          Voice input isn't available in this browser — typed moves still work.
        </p>
      )}

      <StatusLine />
      <div className="mt-2">
        <PeekPanel />
        <MoveList />
      </div>
      <MessageLog />
      <div className="flex flex-col gap-2 pt-1">
        <MoveInput mic={micControl} />
        <ActionBar />
      </div>
      <GameOverPanel onNewGame={() => void handleNewGame()} />
    </div>
  );
}
