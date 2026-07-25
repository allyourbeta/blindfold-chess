import { useGameStore } from "@/state/gameStore";
import { formatMovePairs } from "@/services/chess/gameSummary";

export function MoveList() {
  const moves = useGameStore((s) => s.moveHistory);
  const text = moves.length ? formatMovePairs(moves) : null;

  return (
    <div className="mb-2 min-h-9 overflow-x-auto whitespace-nowrap rounded-lg border border-border-default bg-bg-surface-alt px-4 py-3 font-mono text-sm text-text-secondary">
      {text ?? <span className="font-sans italic text-text-muted">No moves yet</span>}
    </div>
  );
}
