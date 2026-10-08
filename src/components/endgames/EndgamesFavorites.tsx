import { EndgamesHeader } from "./EndgamesHeader";
import { EndgameCard } from "./EndgameCard";
import { RandomButton } from "./RandomButton";
import { randomFrom, type EndgamePosition } from "@/services/endgames/catalog";
import { favoriteEntries } from "@/services/endgames/catalogGroups";
import { useFavorites } from "@/state/favoritesStore";

interface EndgamesFavoritesProps {
  engineReady: boolean;
  onBack(): void;
  onOpenPosition(entry: EndgamePosition): void;
}

export function EndgamesFavorites({ engineReady, onBack, onOpenPosition }: EndgamesFavoritesProps) {
  const codes = useFavorites((s) => s.codes);
  const entries = favoriteEntries(codes);

  return (
    <div
      data-testid="endgame-scroll"
      className="flex h-full w-full flex-col gap-4 overflow-y-auto px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
    >
      <EndgamesHeader
        title="Favorites"
        subtitle={entries.length === 0 ? "None yet" : `${entries.length} position${entries.length === 1 ? "" : "s"}`}
        onBack={onBack}
        right={
          entries.length > 0 ? (
            <RandomButton
              ariaLabel="Random favorite"
              disabled={!engineReady}
              onClick={() => onOpenPosition(randomFrom(entries))}
            />
          ) : undefined
        }
      />

      {entries.length === 0 ? (
        <p className="pt-2 text-center text-base text-text-secondary">
          No favorites yet.
          <br />
          Tap the star on a position to add it.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {entries.map((entry) => (
            <EndgameCard key={entry.id} entry={entry} onClick={() => onOpenPosition(entry)} showBucket />
          ))}
        </div>
      )}
    </div>
  );
}
