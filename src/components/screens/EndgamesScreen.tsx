import { useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { ENDGAMES, getById, randomFrom, type SizeBucket, type EndgamePosition } from "@/services/endgames/catalog";
import { bucketEntries, bucketOfEntry, entriesByBucket } from "@/services/endgames/catalogGroups";
import { EndgamesHome } from "@/components/endgames/EndgamesHome";
import { EndgamesSize } from "@/components/endgames/EndgamesSize";
import { EndgamesPosition } from "@/components/endgames/EndgamesPosition";
import { EndgamesFavorites } from "@/components/endgames/EndgamesFavorites";

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
}

/**
 * One component with three internal views (home | size | position) rather
 * than three app-level screens -- the back arrow moving between them is
 * local navigation, not something App.tsx needs to know about. Only
 * reaching this screen in the first place, and leaving it for Play, cross
 * that boundary.
 */
export function EndgamesScreen({ initialBucket, onMenu, onPlay }: EndgamesScreenProps) {
  const [view, setView] = useState<View>(initialBucket ? { kind: "size", bucket: initialBucket } : { kind: "home" });
  const engineReady = useGameStore((s) => s.engineStatus === "ready");
  const startEndgame = useGameStore((s) => s.startEndgame);

  function openPosition(entry: EndgamePosition, from: "favorites" | "other" = "other") {
    setView({ kind: "position", id: entry.id, from });
  }

  async function playBlindfold(id: string) {
    await startEndgame(id);
    onPlay();
  }

  if (view.kind === "home") {
    return (
      <EndgamesHome
        key="home"
        engineReady={engineReady}
        onBack={onMenu}
        onOpenSize={(bucket) => setView({ kind: "size", bucket })}
        onOpenPosition={openPosition}
        onOpenFavorites={() => setView({ kind: "favorites" })}
        onRandom={() => openPosition(randomFrom(ENDGAMES))}
      />
    );
  }

  if (view.kind === "favorites") {
    return (
      <EndgamesFavorites
        key="favorites"
        engineReady={engineReady}
        onBack={() => setView({ kind: "home" })}
        onOpenPosition={(entry) => openPosition(entry, "favorites")}
      />
    );
  }

  if (view.kind === "size") {
    const bucket = view.bucket;
    return (
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
  }

  const entry = getById(view.id);
  if (!entry) {
    // Shouldn't happen (a stale id), but never crash the screen over it.
    return (
      <EndgamesHome
        key="home"
        engineReady={engineReady}
        onBack={onMenu}
        onOpenSize={(bucket) => setView({ kind: "size", bucket })}
        onOpenPosition={openPosition}
        onOpenFavorites={() => setView({ kind: "favorites" })}
        onRandom={() => openPosition(randomFrom(ENDGAMES))}
      />
    );
  }

  return (
    <EndgamesPosition
      // Same reasoning as the size view's key: "Another of this size" swaps
      // `entry` without changing `view.kind`, so without a key keyed to the
      // id the position view would keep its old scroll position across
      // positions instead of starting at the top (decision 5).
      key={entry.id}
      entry={entry}
      engineReady={engineReady}
      onBack={() =>
        setView(view.from === "favorites" ? { kind: "favorites" } : { kind: "size", bucket: bucketOfEntry(entry) })
      }
      onPlayBlindfold={() => void playBlindfold(entry.id)}
      onAnotherOfThisSize={() => openPosition(randomFrom(bucketEntries(entry), entry.id))}
    />
  );
}
