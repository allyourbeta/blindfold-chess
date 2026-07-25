import { create } from "zustand";

/** "continuous" is the normal Web Speech API mode; iOS often has to degrade to push-to-talk. */
export type SpeechMode = "unsupported" | "continuous" | "push-to-talk";

interface SpeechState {
  mode: SpeechMode;
  isListening: boolean;
  isSpeaking: boolean;
  lastHeard: string | null;
  lastResolvedText: string | null;
  setMode(mode: SpeechMode): void;
  setListening(listening: boolean): void;
  setSpeaking(speaking: boolean): void;
  setLastHeard(heard: string | null, resolvedText?: string | null): void;
}

export const useSpeechStore = create<SpeechState>((set) => ({
  mode: "unsupported",
  isListening: false,
  isSpeaking: false,
  lastHeard: null,
  lastResolvedText: null,
  setMode: (mode) => set({ mode }),
  setListening: (isListening) => set({ isListening }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  setLastHeard: (heard, resolvedText = null) => set({ lastHeard: heard, lastResolvedText: resolvedText }),
}));
