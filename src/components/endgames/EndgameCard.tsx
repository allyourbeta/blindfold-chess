import { Star } from "lucide-react";
import { MiniBoard } from "@/components/board/MiniBoard";
import { sizeOf, type EndgamePosition } from "@/services/endgames/catalog";
import { sideToMove, bucketOfEntry } from "@/services/endgames/catalogGroups";
import { useFavorites } from "@/state/favoritesStore";

interface EndgameCardProps {
  entry: EndgamePosition;
  onClick(): void;
  /** Search results show which size bucket an entry is in; a size-filtered list already knows. */
  showBucket?: boolean;
}

/** One board, two per row -- the grid card every position list (by size, or search) now uses. */
export function EndgameCard({ entry, onClick, showBucket }: EndgameCardProps) {
  const side = sideToMove(entry);
  const count = sizeOf(entry.fen);
  const isFavorite = useFavorites((s) => s.isFavorite(entry.code));
  const sideText = `${side === "w" ? "White" : "Black"} to move`;
  const sideLine = showBucket ? `${bucketOfEntry(entry).label}. ${sideText}` : sideText;

  return (
    <button
      type="button"
      data-testid="endgame-row"
      onClick={onClick}
      aria-label={`${entry.name ?? entry.code}, ${sideText}, ${count} pieces${isFavorite ? ", favorite" : ""}`}
      className="flex flex-col rounded-xl p-1 text-left hover:bg-bg-surface-alt"
    >
      <div className="relative w-full">
        <MiniBoard fen={entry.fen} flipped={side === "b"} />
        {isFavorite && (
          <span
            data-testid="card-favorite-star"
            className="absolute right-1 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-bg-surface text-text-accent shadow"
          >
            <Star className="h-3.5 w-3.5" fill="currentColor" />
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-text-primary">{entry.code}</span>
        <span className="shrink-0 text-sm font-bold text-text-muted">{count}</span>
      </div>
      {entry.name && <div className="truncate text-sm font-bold text-text-primary">{entry.name}</div>}
      <div className="truncate text-xs text-text-secondary">{sideLine}</div>
    </button>
  );
}
