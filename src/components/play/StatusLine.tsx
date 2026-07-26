import { useGameStore } from "@/state/gameStore";
import { formatStatusLine } from "@/services/chess/gameSummary";

export function StatusLine() {
  const turn = useGameStore((s) => s.turn);
  const playerColor = useGameStore((s) => s.playerColor);
  const moveCount = useGameStore((s) => s.moveHistory.length);
  const gameOverFlag = useGameStore((s) => s.gameOverFlag);
  const gameOverText = useGameStore((s) => s.gameOverOutcome?.text);
  const peekCount = useGameStore((s) => s.peekCount);
  const skillLabel = useGameStore((s) => s.activeSkillLabel);

  const text =
    gameOverFlag && gameOverText
      ? gameOverText
      : formatStatusLine(moveCount, turn, playerColor) + (skillLabel ? ` \u00b7 ${skillLabel}` : "");

  return (
    <div className="border-b border-border-default pb-2">
      <div className="text-center text-sm font-medium tracking-wide text-text-accent">{text}</div>
      <div className="text-center font-mono text-xs text-text-muted">Peeks: {peekCount}</div>
    </div>
  );
}
