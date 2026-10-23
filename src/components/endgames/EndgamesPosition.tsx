import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BoardPanel } from "@/components/board/BoardPanel";
import { EndgamesHeader } from "./EndgamesHeader";
import { fenToBoard } from "@/services/chess/fen";
import { sizeOf, FAMILY_INFO, type EndgamePosition } from "@/services/endgames/catalog";
import { sideToMove, displayNameFor, familyOf, bucketOfEntry, resultDisplay } from "@/services/endgames/catalogGroups";
import { useFavorites } from "@/state/favoritesStore";
import { useCreator } from "@/state/creatorStore";
import { useRemovedStore } from "@/state/removedStore";

interface EndgamesPositionProps {
  entry: EndgamePosition;
  /** Ready, or failed (so the error line's own button stays tappable to retry) — not while loading or idle. */
  canStart: boolean;
  /** Set when the last Play Blindfold attempt failed to start the engine — shown under the buttons, null otherwise. */
  startError: string | null;
  onBack(): void;
  onPlayBlindfold(): void;
  onAnotherOfThisSize(): void;
  /** Opens Position Setup preloaded with this position. Nothing is saved to the lab. */
  onEditPosition(): void;
  /** Called after a successful Remove (decision 10) — navigates back to the list, same as onBack. */
  onRemoved(): void;
}

export function EndgamesPosition({
  entry,
  canStart,
  startError,
  onBack,
  onPlayBlindfold,
  onAnotherOfThisSize,
  onEditPosition,
  onRemoved,
}: EndgamesPositionProps) {
  const side = sideToMove(entry);
  const bucket = bucketOfEntry(entry);
  const family = familyOf(entry);
  const isFavorite = useFavorites((s) => s.isFavorite(entry.code));
  const toggleFavorite = useFavorites((s) => s.toggle);
  const result = resultDisplay(entry);
  const unlocked = useCreator((s) => s.password !== null);
  const removeViaApi = useRemovedStore((s) => s.removeViaApi);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleRemove() {
    if (!window.confirm(`Remove ${entry.code} from the app for everyone?`)) return;
    setRemoving(true);
    setRemoveError(null);
    const removeResult = await removeViaApi(entry.code);
    setRemoving(false);
    if (removeResult.ok) onRemoved();
    else setRemoveError(removeResult.error ?? "Could not remove.");
  }

  return (
    <div
      data-testid="endgame-scroll"
      className="flex h-full w-full flex-col gap-4 overflow-y-auto px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
    >
      <EndgamesHeader
        title={bucket.label}
        subtitle={FAMILY_INFO[family].label}
        backLabel="Back"
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
      </div>

      <Button variant="primary" size="big" disabled={!canStart} onClick={onPlayBlindfold}>
        Play Blindfold
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="big" disabled={!canStart} onClick={onAnotherOfThisSize}>
          Another of this size
        </Button>
        <Button variant="secondary" size="big" onClick={onEditPosition}>
          Edit position
        </Button>
      </div>

      {startError && <p className="text-sm text-text-error">{startError}</p>}

      {entry.source && <p className="text-sm text-text-muted">Source: {entry.source.title}.</p>}

      {unlocked && (
        <>
          <Button variant="destructive" size="sm" className="self-end" disabled={removing} onClick={() => void handleRemove()}>
            Remove
          </Button>
          {removeError && <p className="text-sm text-text-error">{removeError}</p>}
        </>
      )}
    </div>
  );
}
