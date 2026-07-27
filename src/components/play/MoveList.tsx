import { useGameStore } from "@/state/gameStore";
import { useSettingsStore } from "@/state/settingsStore";
import { formatMovePairs } from "@/services/chess/gameSummary";

/**
 * The move ticker is opt-in aid: hidden by default, toggled by tapping the
 * row. The row itself never moves or resizes — only its content changes.
 */
export function MoveList() {
  const moves = useGameStore((s) => s.moveHistory);
  const showTicker = useSettingsStore((s) => s.showTicker);
  const toggleTicker = useSettingsStore((s) => s.toggleTicker);
  const text = moves.length ? formatMovePairs(moves) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={showTicker ? "Move list — tap to hide" : "Move list hidden — tap to show"}
      onClick={toggleTicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") toggleTicker();
      }}
      className="mb-1.5 min-h-9 cursor-pointer overflow-x-auto whitespace-nowrap rounded-lg border border-border-default bg-bg-surface-alt px-4 py-2 font-mono text-sm text-text-secondary"
    >
      {showTicker ? (
        (text ?? <span className="font-sans italic text-text-muted">No moves yet</span>)
      ) : (
        <span className="font-sans italic text-text-muted">Moves hidden</span>
      )}
    </div>
  );
}
