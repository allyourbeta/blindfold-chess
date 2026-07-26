import { ArrowLeft, Mic, Square, Volume2 } from "lucide-react";
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

  const isTap = speech.mode === "tap";

  function compactMicButton() {
    const isUnavailable = speech.isSpeaking;
    return (
      <Button
        type="button"
        size="icon"
        className="h-12 w-12 shrink-0"
        variant={speech.isListening ? "primary" : "secondary"}
        active={speech.isListening}
        disabled={isUnavailable}
        onClick={speech.toggleListening}
        aria-label={speech.isListening ? "Stop listening" : "Start listening"}
      >
        {isUnavailable ? (
          <Volume2 className="h-5 w-5" />
        ) : speech.isListening ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>
    );
  }

  function tapMicPad() {
    const state = speech.isSpeaking ? "speaking" : speech.isListening ? "listening" : "idle";
    const variant = state === "listening" ? "destructive" : state === "speaking" ? "secondary" : "primary";

    return (
      <Button
        type="button"
        className="h-28 w-full flex-col gap-1.5 whitespace-normal px-4 text-center"
        variant={variant}
        disabled={state === "speaking"}
        onClick={speech.toggleListening}
        aria-label={state === "listening" ? "Stop listening" : state === "speaking" ? "Engine speaking" : "Start listening"}
      >
        {state === "idle" && (
          <>
            <Mic className="h-8 w-8" />
            <span className="text-lg font-extrabold leading-none">Tap to speak</span>
            <span className="text-sm font-semibold opacity-75">Say your move</span>
          </>
        )}

        {state === "listening" && (
          <>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-pulse rounded-full bg-white" aria-hidden="true" />
              <Square className="h-5 w-5 fill-current" />
            </span>
            <span className="text-lg font-extrabold leading-none">Listening…</span>
            <span className="text-sm font-semibold opacity-90">Say your move · tap to stop</span>
          </>
        )}

        {state === "speaking" && (
          <>
            <Volume2 className="h-8 w-8" />
            <span className="text-lg font-extrabold leading-none">Engine speaking…</span>
            <span className="text-sm font-semibold text-text-secondary">Microphone will be ready next</span>
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="flex h-full w-full flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-3 flex items-center justify-between border-b border-border-default pb-3">
        <button onClick={handleMenu} aria-label="Back to menu" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-bg-surface-alt">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-base font-extrabold tracking-widest text-text-accent">MIND'S EYE</div>
        <div className="h-11 w-11" aria-hidden />
      </div>

      {speech.mode === "unsupported" && (
        <p className="mb-2 text-center text-xs text-text-muted">
          Voice input isn't available in this browser — typed moves still work.
        </p>
      )}
      {speech.inputError && (
        <p role="alert" className="mb-2 rounded-lg border border-border-default bg-bg-surface-alt px-3 py-2 text-center text-sm text-text-secondary">
          {speech.inputError}
        </p>
      )}

      <StatusLine />
      <div className="mt-2">
        <PeekPanel />
        <MoveList />
      </div>
      <MessageLog />
      <div className="flex flex-col gap-2 pt-1">
        <MoveInput mic={speech.mode === "continuous" ? compactMicButton() : undefined} />
        {isTap && tapMicPad()}
        <ActionBar />
      </div>
      <GameOverPanel onNewGame={() => void handleNewGame()} onMenu={handleMenu} />
    </div>
  );
}
