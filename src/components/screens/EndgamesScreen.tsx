import { useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { ENDGAMES, getById, randomFrom, type Family, type EndgamePosition } from "@/services/endgames/catalog";
import { entriesByFamily, familyOf, groupEntries } from "@/services/endgames/catalogGroups";
import { EndgamesHome } from "@/components/endgames/EndgamesHome";
import { EndgamesFamily } from "@/components/endgames/EndgamesFamily";
import { EndgamesPosition } from "@/components/endgames/EndgamesPosition";

type View = { kind: "home" } | { kind: "family"; family: Family } | { kind: "position"; id: string };

interface EndgamesScreenProps {
  /** Lands straight on this family's list -- the game-over "Endgames" button's entry point. Null starts at home. */
  initialFamily: Family | null;
  onMenu(): void;
  onPlay(): void;
}

/**
 * One component with three internal views (home | family | position) rather
 * than three app-level screens -- the back arrow moving between them is
 * local navigation, not something App.tsx needs to know about. Only
 * reaching this screen in the first place, and leaving it for Play, cross
 * that boundary.
 */
export function EndgamesScreen({ initialFamily, onMenu, onPlay }: EndgamesScreenProps) {
  const [view, setView] = useState<View>(
    initialFamily ? { kind: "family", family: initialFamily } : { kind: "home" },
  );
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
        onOpenFamily={(family) => setView({ kind: "family", family })}
        onOpenPosition={openPosition}
        onRandom={() => openPosition(randomFrom(ENDGAMES))}
      />
    );
  }

  if (view.kind === "family") {
    const family = view.family;
    return (
      <EndgamesFamily
        family={family}
        engineReady={engineReady}
        onBack={() => setView({ kind: "home" })}
        onOpenPosition={openPosition}
        onRandom={() => openPosition(randomFrom(entriesByFamily(family)))}
      />
    );
  }

  const entry = getById(view.id);
  if (!entry) {
    // Shouldn't happen (a stale id), but never crash the screen over it.
    return <EndgamesHome engineReady={engineReady} onBack={onMenu} onOpenFamily={(family) => setView({ kind: "family", family })} onOpenPosition={openPosition} onRandom={() => openPosition(randomFrom(ENDGAMES))} />;
  }

  return (
    <EndgamesPosition
      entry={entry}
      engineReady={engineReady}
      onBack={() => setView({ kind: "family", family: familyOf(entry) })}
      onPlayBlindfold={() => void playBlindfold(entry.id)}
      onAnotherFromGroup={() => openPosition(randomFrom(groupEntries(entry), entry.id))}
    />
  );
}
