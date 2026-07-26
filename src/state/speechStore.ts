import { create } from "zustand";

/**
 * "continuous" is the normal Web Speech API mode. "tap" is one recognition
 * session per mic tap — the default on iOS, where continuous mode isn't
 * honored, and the fallback everywhere else when continuous keeps failing.
 */
export type SpeechMode = "unsupported" | "continuous" | "tap";

interface SpeechState {
  mode: SpeechMode;
  isListening: boolean;
  isSpeaking: boolean;
  /** When the app last finished speaking — late-arriving transcripts of our own voice are dropped against this. */
  speakingEndedAt: number;
  /** The last few sentence phrases the app spoke, for the echo filter. Move announcements are not remembered — see echo.ts. */
  recentSpokenTexts: string[];
  lastHeard: string | null;
  lastResolvedText: string | null;
  setMode(mode: SpeechMode): void;
  setListening(listening: boolean): void;
  setSpeaking(speaking: boolean): void;
  rememberSpokenText(text: string): void;
  setLastHeard(heard: string | null, resolvedText?: string | null): void;
}

export const useSpeechStore = create<SpeechState>((set) => ({
  mode: "unsupported",
  isListening: false,
  isSpeaking: false,
  speakingEndedAt: 0,
  recentSpokenTexts: [],
  lastHeard: null,
  lastResolvedText: null,
  setMode: (mode) => set({ mode }),
  setListening: (isListening) => set({ isListening }),
  setSpeaking: (isSpeaking) =>
    set(isSpeaking ? { isSpeaking: true } : { isSpeaking: false, speakingEndedAt: Date.now() }),
  rememberSpokenText: (text) =>
    set((s) => ({ recentSpokenTexts: [...s.recentSpokenTexts.slice(-3), text] })),
  setLastHeard: (heard, resolvedText = null) => set({ lastHeard: heard, lastResolvedText: resolvedText }),
}));
