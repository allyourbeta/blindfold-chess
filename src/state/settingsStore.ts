import { create } from "zustand";
import {
  getThemePreference,
  setThemePreference,
  getFileNaming,
  setFileNaming as persistFileNaming,
  getSpeechMode,
  setSpeechMode as persistSpeechMode,
  type ThemePreference,
  type FileNaming,
  type SpeechMode,
} from "@/api/localStore";
import type { Color } from "chess.js";

export interface SkillLevel {
  label: string;
  depth: number;
  skill: number;
}

/** Unchanged from the original app — depth/skill values must not drift. */
export const SKILL_LEVELS: SkillLevel[] = [
  { label: "Beginner (~800)", depth: 1, skill: 0 },
  { label: "Casual (~1200)", depth: 3, skill: 5 },
  { label: "Club (~1500)", depth: 5, skill: 8 },
  { label: "Intermediate (~1800)", depth: 8, skill: 12 },
  { label: "Strong (~2000)", depth: 10, skill: 15 },
  { label: "Expert (~2200)", depth: 12, skill: 18 },
  { label: "Master (~2500)", depth: 15, skill: 20 },
  { label: "Full Strength", depth: 18, skill: 20 },
];

interface SettingsState {
  playerColor: Color;
  skillIndex: number;
  speechMode: SpeechMode;
  /** null = follow the side you're playing; true/false = you rotated it yourself. */
  boardFlipOverride: boolean | null;
  fileNaming: FileNaming;
  theme: ThemePreference;
  setPlayerColor(color: Color): void;
  setSkillIndex(index: number): void;
  setFileNaming(mode: FileNaming): void;
  setSpeechMode(mode: SpeechMode): void;
  toggleBoardFlip(currentDefault: boolean): void;
  setTheme(theme: ThemePreference): void;
  toggleTheme(): void;
}

function initialTheme(): ThemePreference {
  // Light by default, regardless of the OS setting — this app is light-first,
  // matching timeboxxer/intabyu. Dark is opt-in via the toggle and persists.
  return getThemePreference() ?? "light";
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  playerColor: "w",
  skillIndex: 2,
  // NATO by default: b/c/d/e/g are indistinguishable as bare letters.
  fileNaming: getFileNaming() ?? "letters",
  speechMode: getSpeechMode() ?? "on",
  boardFlipOverride: null,
  theme: initialTheme(),
  setPlayerColor: (color) => set({ playerColor: color, boardFlipOverride: null }),
  setSkillIndex: (index) => set({ skillIndex: index }),
  setFileNaming: (mode) => {
    persistFileNaming(mode);
    set({ fileNaming: mode });
  },
  toggleBoardFlip: (currentDefault) => {
    const current = get().boardFlipOverride ?? currentDefault;
    set({ boardFlipOverride: !current });
  },

  setSpeechMode: (mode) => {
    persistSpeechMode(mode);
    set({ speechMode: mode });
  },
  setTheme: (theme) => {
    setThemePreference(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));
