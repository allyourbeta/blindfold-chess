import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BoardPanel } from "@/components/board/BoardPanel";
import { EndgamesHeader } from "./EndgamesHeader";
import { fenToBoard } from "@/services/chess/fen";
import { pieceList, sizeOf, FAMILY_INFO, type EndgamePosition } from "@/services/endgames/catalog";
import { sideToMove, displayNameFor, familyOf, bucketOfEntry } from "@/services/endgames/catalogGroups";
import { useFavorites } from "@/state/favoritesStore";

interface EndgamesPositionProps {
  entry: EndgamePosition;
  engineReady: boolean;
  onBack(): void;
  onPlayBlindfold(): void;
  onAnotherOfThisSize(): void;
}

export function EndgamesPosition({
  entry,
  engineReady,
  onBack,
  onPlayBlindfold,
  onAnotherOfThisSize,
}: EndgamesPositionProps) {
  const side = sideToMove(entry);
  const bucket = bucketOfEntry(entry);
  const family = familyOf(entry);
  const isFavorite = useFavorites((s) => s.isFavorite(entry.code));
  const toggleFavorite = useFavorites((s) => s.toggle);

  return (
    <div
      data-testid="endgame-scroll"
      className="flex h-full w-full flex-col gap-4 overflow-y-auto px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
    >
      <EndgamesHeader
        title={bucket.label}
        subtitle={FAMILY_INFO[family].label}
        onBack={onBack}
        right={
          <button
            type="button"
            onClick={() => toggleFavorite(entry.code)}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={isFavorite}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-accent hover:bg-bg-surface-alt"
          >
            <Star className="h-6 w-6" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        }
      />

      <BoardPanel board={fenToBoard(entry.fen)} defaultFlipped={side === "b"} />

      <div>
        <p className="text-xl font-extrabold text-text-primary">
          {displayNameFor(entry)}
          {entry.name && <span className="ml-2 font-mono text-sm font-bold text-text-secondary">{entry.code}</span>}
        </p>
        <p className="mt-1 text-base font-bold text-text-accent">
          You play {side === "w" ? "White" : "Black"}. {sizeOf(entry.fen)} pieces.
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          White: {pieceList(entry.fen, "w")}
          <br />
          Black: {pieceList(entry.fen, "b")}
        </p>
      </div>

      <Button variant="primary" className="w-full" disabled={!engineReady} onClick={onPlayBlindfold}>
        Play Blindfold
      </Button>
      <Button variant="secondary" className="w-full" disabled={!engineReady} onClick={onAnotherOfThisSize}>
        Another of this size
      </Button>

      <p className="text-sm text-text-muted">Source: {entry.source.title}.</p>
    </div>
  );
}
