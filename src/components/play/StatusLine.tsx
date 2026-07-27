import { useGameStore } from "@/state/gameStore";

/**
 * One line, deliberately spare. The move number is aid (counting done for
 * you) and lives only in the ticker, which is opt-in. Whose turn it is
 * stays: that's game state, not assistance.
 */
export function StatusLine() {
  const turn = useGameStore((s) => s.turn);
  const playerColor = useGameStore((s) => s.playerColor);
  const gameOverFlag = useGameStore((s) => s.gameOverFlag);
  const gameOverText = useGameStore((s) => s.gameOverOutcome?.text);
  const peekCount = useGameStore((s) => s.peekCount);
  const skillLabel = useGameStore((s) => s.activeSkillLabel);

  const text =
    gameOverFlag && gameOverText
      ? gameOverText
      : [turn === playerColor ? "Your move" : "Engine's move", skillLabel, `Peeks: ${peekCount}`]
          .filter(Boolean)
          .join(" \u00b7 ");

  return (
    <div className="border-b border-border-default pb-1.5">
      <div className="truncate text-center text-base font-semibold tracking-wide text-text-accent shortscape:text-sm">{text}</div>
    </div>
  );
}
