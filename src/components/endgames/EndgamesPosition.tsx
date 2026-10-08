import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BoardPanel } from "@/components/board/BoardPanel";
import { EndgamesHeader } from "./EndgamesHeader";
import { fenToBoard } from "@/services/chess/fen";
import { pieceList, sizeOf, FAMILY_INFO, type EndgamePosition } from "@/services/endgames/catalog";
import { sideToMove, displayNameFor, familyOf, bucketOfEntry, resultDisplay } from "@/services/endgames/catalogGroups";
import { useFavorites } from "@/state/favoritesStore";

interface EndgamesPositionProps {
  entry: EndgamePosition;
  /** Ready, or failed (so the error line's own button stays tappable to retry) — not while loading or idle. */
  canStart: boolean;
  /** Set when the last Play Blindfold attempt failed to start the engine — shown under the buttons, null otherwise. */
  startError: string | null;
  onBack(): void;
  onPlayBlindfold(): void;
  onAnotherOfThisSize(): void;
}

export function EndgamesPosition({
  entry,
  canStart,
  startError,
  onBack,
  onPlayBlindfold,
  onAnotherOfThisSize,
}: EndgamesPositionProps) {
  const side = sideToMove(entry);
  const bucket = bucketOfEntry(entry);
  const family = familyOf(entry);
  const isFavorite = useFavorites((s) => s.isFavorite(entry.code));
  const toggleFavorite = useFavorites((s) => s.toggle);
  const result = resultDisplay(entry);

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
        {result && (
          <p className="mt-1.5 inline-flex items-baseline gap-2 text-sm text-text-secondary">
            <span>{result.label}</span>
            <span className="rounded-lg border border-border-emphasis bg-bg-surface-alt px-2 py-0.5 font-mono text-base font-extrabold text-text-primary">
              {result.score}
            </span>
          </p>
        )}
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          White: {pieceList(entry.fen, "w")}
          <br />
          Black: {pieceList(entry.fen, "b")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="primary" size="big" disabled={!canStart} onClick={onPlayBlindfold}>
          Play Blindfold
        </Button>
        <Button variant="secondary" size="big" disabled={!canStart} onClick={onAnotherOfThisSize}>
          Another of this size
        </Button>
      </div>

      {startError && <p className="text-sm text-text-error">{startError}</p>}

      <p className="text-sm text-text-muted">Source: {entry.source.title}.</p>
    </div>
  );
}
