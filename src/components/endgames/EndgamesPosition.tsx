import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BoardPanel } from "@/components/board/BoardPanel";
import { EndgamesHeader } from "./EndgamesHeader";
import { fenToBoard } from "@/services/chess/fen";
import { FAMILY_INFO, type EndgamePosition } from "@/services/endgames/catalog";
import { sideToMove, familyOf, bucketOfEntry, resultDisplay } from "@/services/endgames/catalogGroups";
import { useFavorites } from "@/state/favoritesStore";
import { useCreator } from "@/state/creatorStore";
import { useRemovedStore } from "@/state/removedStore";
import { useSettingsStore } from "@/state/settingsStore";
import { cn } from "@/lib/cn";

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
  const resetBoardFlip = useSettingsStore((s) => s.resetBoardFlip);

  // Flips are local (decision 7): a lab position always opens in its default
  // orientation, even if the last position or game was flipped.
  useEffect(() => {
    resetBoardFlip();
  }, [entry.code, resetBoardFlip]);

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
      className="flex h-full w-full flex-col gap-4 overflow-y-auto px-6 pt-[max(1.5rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(2.5rem,env(safe-area-inset-bottom))] [&>*]:shrink-0"
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
            data-flat="icon"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-accent hover:bg-bg-surface-alt"
          >
            <Star className="h-6 w-6" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        }
      />

      <BoardPanel board={fenToBoard(entry.fen)} defaultFlipped={side === "b"} showRotate={false} />

      <div>
        {entry.name && <p className="text-xl font-extrabold text-text-primary">{entry.name}</p>}
        <div className="mt-1 flex min-h-11 items-center gap-2.5">
          <span className="inline-flex items-center text-base font-bold text-text-primary">
            <span
              className={cn(
                "mr-1.5 inline-block h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-text-primary",
                side === "w" ? "bg-white" : "bg-text-primary",
              )}
            />
            {side === "w" ? "White to move" : "Black to move"}
          </span>
          {result && (
            <span
              aria-label={result.spoken}
              className="inline-flex h-[30px] items-center rounded-full border border-border-emphasis bg-bg-surface-alt px-3 font-mono text-base font-extrabold text-text-primary"
            >
              {result.score}
            </span>
          )}
          <span className="ml-auto truncate font-mono text-xs text-text-muted">{entry.code}</span>
        </div>
      </div>

      <Button variant="primary" size="big" disabled={!canStart} onClick={onPlayBlindfold}>
        Play Blindfold
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="big" disabled={!canStart} onClick={onAnotherOfThisSize}>
          Next
        </Button>
        <Button variant="secondary" size="big" onClick={onEditPosition}>
          Edit
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
