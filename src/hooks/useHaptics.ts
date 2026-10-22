import { useEffect, useRef } from "react";
import { useGameStore } from "@/state/gameStore";
import { hapticTap } from "@/services/haptics";

/** Reacts to the engine's own moves with a tap -- see SPEC_rename_haptics.md. */
export function useHaptics() {
  const audioEvent = useGameStore((s) => s.audioEvent);
  const lastHandledRef = useRef<typeof audioEvent>(null);

  useEffect(() => {
    // Same last-handled-event guard as useSpeechOutput -- this effect must
    // not re-fire the tap for an event it already handled.
    if (audioEvent === lastHandledRef.current) return;
    lastHandledRef.current = audioEvent;
    if (audioEvent?.kind === "move" && audioEvent.by === "engine") hapticTap();
  }, [audioEvent]);
}
