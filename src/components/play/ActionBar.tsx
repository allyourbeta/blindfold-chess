import { Eye, Undo2, Lightbulb, Flag, RotateCcw, ClipboardCopy, Volume2, FileCode, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/state/gameStore";
import { useSettingsStore } from "@/state/settingsStore";
import { unlockAudioOutput } from "@/hooks/useSpeechOutput";

/**
 * Two rows, on purpose.
 *
 * Primary holds what you reach for inside a move — peek, hint, takeback. They
 * sit closest to the input because that's where your hands and eyes already
 * are. Secondary holds the rare and the destructive, behind a rule, so New
 * Game and Resign can never end up sandwiched between buttons you tap fast.
 */
export function ActionBar() {
  const gameOverFlag = useGameStore((s) => s.gameOverFlag);
  const moveCount = useGameStore((s) => s.moveHistory.length);
  const doPeek = useGameStore((s) => s.doPeek);
  const doTakeback = useGameStore((s) => s.doTakeback);
  const requestHint = useGameStore((s) => s.requestHint);
  const doResign = useGameStore((s) => s.doResign);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const copyPgn = useGameStore((s) => s.copyPgn);
  const submitMoveText = useGameStore((s) => s.submitMoveText);
  const speechMode = useSettingsStore((s) => s.speechMode);
  const fileNaming = useSettingsStore((s) => s.fileNaming);
  const setFileNaming = useSettingsStore((s) => s.setFileNaming);
  const setSpeechMode = useSettingsStore((s) => s.setSpeechMode);

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" disabled={gameOverFlag} onClick={doPeek} aria-label="Peek at the board" title="See the board for 3 seconds">
          <Eye className="h-4 w-4" /> Peek
        </Button>
        <Button variant="secondary" disabled={gameOverFlag} onClick={requestHint} title="Show legal moves">
          <Lightbulb className="h-4 w-4" /> Hint
        </Button>
        <Button
          variant="secondary"
          disabled={gameOverFlag || moveCount === 0}
          onClick={doTakeback}
          title="Undo last move pair"
        >
          <Undo2 className="h-4 w-4" /> Takeback
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-default pt-2">
        <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSpeechMode(speechMode === "on" ? "off" : "on")}
          title="Whether the engine's moves are spoken aloud"
        >
          <Volume2 className="h-4 w-4" /> Engine speaks: {speechMode === "on" ? "On" : "Off"}
        </Button>
        {speechMode === "on" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFileNaming(fileNaming === "nato" ? "letters" : "nato")}
            title="How letters are spoken — Alpha: b, d, e · NATO: Bravo, Delta, Echo"
          >
            {fileNaming === "nato" ? "NATO" : "Alpha"}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => void copyPgn()} title="Copy game notation">
          <ClipboardCopy className="h-4 w-4" /> PGN
        </Button>
        <Button variant="secondary" size="sm" onClick={() => submitMoveText("fen")} title="Show the current position's FEN">
          <FileCode className="h-4 w-4" /> FEN
        </Button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => submitMoveText("history")} title="Past games and stats">
          <History className="h-4 w-4" /> History
        </Button>
        <Button variant="secondary" size="sm" disabled={gameOverFlag} onClick={doResign}>
          <Flag className="h-4 w-4" /> Resign
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            unlockAudioOutput();
            void startNewGame();
          }}
        >
          <RotateCcw className="h-4 w-4" /> New Game
        </Button>
        </div>
      </div>
    </div>
  );
}
