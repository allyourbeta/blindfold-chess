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
