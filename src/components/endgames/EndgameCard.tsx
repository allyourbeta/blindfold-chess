import { MiniBoard } from "@/components/board/MiniBoard";
import { sizeOf, type EndgamePosition } from "@/services/endgames/catalog";
import { sideToMove, cardLabelFor, bucketOfEntry } from "@/services/endgames/catalogGroups";

interface EndgameCardProps {
  entry: EndgamePosition;
  onClick(): void;
  /** Search results show which size bucket an entry is in; a size-filtered list already knows. */
  showBucket?: boolean;
}

/** One board, two per row -- the grid card every position list (by size, or search) now uses. */
export function EndgameCard({ entry, onClick, showBucket }: EndgameCardProps) {
  const side = sideToMove(entry);
  const label = cardLabelFor(entry);
  const count = sizeOf(entry.fen);
  const sideText = `${side === "w" ? "White" : "Black"} to move`;
  const sideLine = showBucket ? `${bucketOfEntry(entry).label}. ${sideText}` : sideText;

  return (
    <button
      type="button"
      data-testid="endgame-row"
      onClick={onClick}
      aria-label={`${label}, ${sideText}, ${count} pieces`}
      className="flex flex-col rounded-xl p-1 text-left hover:bg-bg-surface-alt"
    >
      <MiniBoard fen={entry.fen} flipped={side === "b"} />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-text-primary">{label}</span>
        <span className="shrink-0 text-sm font-bold text-text-muted">{count}</span>
      </div>
      <div className="truncate text-xs text-text-secondary">{sideLine}</div>
    </button>
  );
}
