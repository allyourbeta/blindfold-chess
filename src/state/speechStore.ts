import { create } from "zustand";

interface SpeechState {
  /** True while a queued utterance is playing — the keypad goes inert until it clears. */
  isSpeaking: boolean;
  setSpeaking(speaking: boolean): void;
}

export const useSpeechStore = create<SpeechState>((set) => ({
  isSpeaking: false,
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
}));

// e2e-only: lets a test read `isSpeaking` straight from the store even after
// the component that would otherwise show it (MoveKeypad) has unmounted --
// e.g. right after leaving the game that was mid-announcement. Nothing in
// the app itself reads this; it's write-once, read-never from production code.
if (typeof window !== "undefined") {
  (window as unknown as { __speechStore?: typeof useSpeechStore }).__speechStore = useSpeechStore;
}
