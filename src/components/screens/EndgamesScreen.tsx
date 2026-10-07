import { useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { ENDGAMES, getById, randomFrom, type SizeBucket, type EndgamePosition } from "@/services/endgames/catalog";
import { bucketEntries, bucketOfEntry, entriesByBucket } from "@/services/endgames/catalogGroups";
import { EndgamesHome } from "@/components/endgames/EndgamesHome";
import { EndgamesSize } from "@/components/endgames/EndgamesSize";
import { EndgamesPosition } from "@/components/endgames/EndgamesPosition";

type View = { kind: "home" } | { kind: "size"; bucket: SizeBucket } | { kind: "position"; id: string };

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

  function openPosition(entry: EndgamePosition) {
    setView({ kind: "position", id: entry.id });
  }

  async function playBlindfold(id: string) {
    await startEndgame(id);
    onPlay();
  }

  if (view.kind === "home") {
    return (
      <EndgamesHome
        engineReady={engineReady}
        onBack={onMenu}
        onOpenSize={(bucket) => setView({ kind: "size", bucket })}
        onOpenPosition={openPosition}
        onRandom={() => openPosition(randomFrom(ENDGAMES))}
      />
    );
  }

  if (view.kind === "size") {
    const bucket = view.bucket;
    return (
      <EndgamesSize
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
        engineReady={engineReady}
        onBack={onMenu}
        onOpenSize={(bucket) => setView({ kind: "size", bucket })}
        onOpenPosition={openPosition}
        onRandom={() => openPosition(randomFrom(ENDGAMES))}
      />
    );
  }

  return (
    <EndgamesPosition
      entry={entry}
      engineReady={engineReady}
      onBack={() => setView({ kind: "size", bucket: bucketOfEntry(entry) })}
      onPlayBlindfold={() => void playBlindfold(entry.id)}
      onAnotherOfThisSize={() => openPosition(randomFrom(bucketEntries(entry), entry.id))}
    />
  );
}
