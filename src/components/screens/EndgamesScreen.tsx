import { useEffect, useState, type ReactNode } from "react";
import { useGameStore, engineStartFailedMessage } from "@/state/gameStore";
import { getById, randomFrom, visibleEndgames, type SizeBucket, type EndgamePosition } from "@/services/endgames/catalog";
import { bucketEntries, bucketOfEntry, entriesByBucket } from "@/services/endgames/catalogGroups";
import { EndgamesHome } from "@/components/endgames/EndgamesHome";
import { EndgamesSize } from "@/components/endgames/EndgamesSize";
import { EndgamesPosition } from "@/components/endgames/EndgamesPosition";
import { EndgamesFavorites } from "@/components/endgames/EndgamesFavorites";
import { useRemovedStore } from "@/state/removedStore";

type View =
  | { kind: "home" }
  | { kind: "size"; bucket: SizeBucket }
  | { kind: "favorites" }
  // `from` tracks where this position was opened from, so the back arrow can
  // return there -- only favorites needs this (decision 6); size and search
  // (opened from home) both already return to the entry's own size bucket.
  | { kind: "position"; id: string; from: "favorites" | "other" };

interface EndgamesScreenProps {
  /** Lands straight on this size's list -- the game-over "Endgames" button's entry point. Null starts at home. */
  initialBucket: SizeBucket | null;
  onMenu(): void;
  onPlay(): void;
  /** Opens Position Setup preloaded with this FEN. Nothing is saved to the lab. */
  onEditPosition(fen: string): void;
}

/**
 * One component with three internal views (home | size | position) rather
 * than three app-level screens -- the back arrow moving between them is
 * local navigation, not something App.tsx needs to know about. Only
 * reaching this screen in the first place, and leaving it for Play, cross
 * that boundary.
 */
export function EndgamesScreen({ initialBucket, onMenu, onPlay, onEditPosition }: EndgamesScreenProps) {
  const [view, setView] = useState<View>(initialBucket ? { kind: "size", bucket: initialBucket } : { kind: "home" });
  const [startError, setStartError] = useState(false);
  const engineStatus = useGameStore((s) => s.engineStatus);
  const engineReady = engineStatus === "ready";
  // Tappable once failed too, not just once ready -- otherwise the error
  // line's own "Tap Play Blindfold to try again" would name a disabled
  // button, with no other way back to a working engine from this screen.
  const canStart = engineStatus === "ready" || engineStatus === "failed";
  const startEndgame = useGameStore((s) => s.startEndgame);
  const removalNote = useRemovedStore((s) => s.note);
  const clearRemovalNote = useRemovedStore((s) => s.clearNote);

  // The note from a just-completed Remove (decision 10) is read once and
  // cleared -- it's not meant to reappear on a later visit to this screen.
  useEffect(() => {
    if (!removalNote) return;
    const timer = setTimeout(clearRemovalNote, 5000);
    return () => clearTimeout(timer);
  }, [removalNote, clearRemovalNote]);

  function openPosition(entry: EndgamePosition, from: "favorites" | "other" = "other") {
    setStartError(false);
    setView({ kind: "position", id: entry.id, from });
  }

  async function playBlindfold(id: string) {
    const ok = await startEndgame(id);
    if (ok) onPlay();
    else setStartError(true);
  }

  let content: ReactNode;

  if (view.kind === "home") {
    content = (
      <EndgamesHome
        key="home"
        engineReady={engineReady}
        onBack={onMenu}
        onOpenSize={(bucket) => setView({ kind: "size", bucket })}
        onOpenPosition={openPosition}
        onOpenFavorites={() => setView({ kind: "favorites" })}
        onRandom={() => openPosition(randomFrom(visibleEndgames()))}
      />
    );
  } else if (view.kind === "favorites") {
    content = (
      <EndgamesFavorites
        key="favorites"
        engineReady={engineReady}
        onBack={() => setView({ kind: "home" })}
        onOpenPosition={(entry) => openPosition(entry, "favorites")}
      />
    );
  } else if (view.kind === "size") {
    const bucket = view.bucket;
    content = (
      <EndgamesSize
        // Forces a fresh mount (and so a scroll reset) on every distinct
        // bucket -- without it, reaching this same `view.kind` from a
        // different bucket keeps the previous instance's scroll position.
        key={bucket.label}
        bucket={bucket}
        engineReady={engineReady}
        onBack={() => setView({ kind: "home" })}
        onOpenPosition={openPosition}
        onRandom={() => openPosition(randomFrom(entriesByBucket(bucket)))}
      />
    );
  } else {
    const entry = getById(view.id);
    if (!entry) {
      // Shouldn't happen (a stale id, or removed from under this view), but
      // never crash the screen over it.
      content = (
        <EndgamesHome
          key="home"
          engineReady={engineReady}
          onBack={onMenu}
          onOpenSize={(bucket) => setView({ kind: "size", bucket })}
          onOpenPosition={openPosition}
          onOpenFavorites={() => setView({ kind: "favorites" })}
          onRandom={() => openPosition(randomFrom(visibleEndgames()))}
        />
      );
    } else {
      const backToList = () =>
        setView(view.from === "favorites" ? { kind: "favorites" } : { kind: "size", bucket: bucketOfEntry(entry) });
      content = (
        <EndgamesPosition
          // Same reasoning as the size view's key: "Another of this size"
          // swaps `entry` without changing `view.kind`, so without a key
          // keyed to the id the position view would keep its old scroll
          // position across positions instead of starting at the top
          // (decision 5).
          key={entry.id}
          entry={entry}
          canStart={canStart}
          startError={startError ? engineStartFailedMessage("Play Blindfold") : null}
          onBack={backToList}
          onPlayBlindfold={() => void playBlindfold(entry.id)}
          onAnotherOfThisSize={() => openPosition(randomFrom(bucketEntries(entry), entry.id))}
          onEditPosition={() => onEditPosition(entry.fen)}
          onRemoved={backToList}
        />
      );
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {removalNote && (
        <div className="absolute inset-x-0 top-0 z-10 bg-bg-primary px-4 py-2 text-center text-sm font-medium text-text-on-primary">
          {removalNote}
        </div>
      )}
      {content}
    </div>
  );
}
