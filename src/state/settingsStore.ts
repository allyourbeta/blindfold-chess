import { create } from "zustand";
import {
  getThemePreference,
  setThemePreference,
  getFileNaming,
  setFileNaming as persistFileNaming,
  getSpeechMode,
  setSpeechMode as persistSpeechMode,
  getShowTicker,
  setShowTicker as persistShowTicker,
  getAssistMode,
  setAssistMode as persistAssistMode,
  getRandomness,
  setRandomness as persistRandomness,
  getOpponent,
  setOpponent as persistOpponent,
  getStockfishLevel,
  setStockfishLevel as persistStockfishLevel,
  type ThemePreference,
  type FileNaming,
  type SpeechMode,
  type AssistMode,
} from "@/api/localStore";
import type { Color } from "chess.js";
import type { OpponentKind, RandomnessStop } from "@/engine/types";
import type { StockfishLevelKey } from "@/engine/stockfishLevels";

interface SettingsState {
  playerColor: Color;
  randomness: RandomnessStop;
  opponent: OpponentKind;
  stockfishLevel: StockfishLevelKey;
  speechMode: SpeechMode;
  /** null = follow the side you're playing; true/false = you rotated it yourself. */
  boardFlipOverride: boolean | null;
  fileNaming: FileNaming;
  theme: ThemePreference;
  showTicker: boolean;
  assistMode: AssistMode;
  setPlayerColor(color: Color): void;
  toggleTicker(): void;
  setAssistMode(mode: AssistMode): void;
  setRandomness(stop: RandomnessStop): void;
  setOpponent(opponent: OpponentKind): void;
  setStockfishLevel(level: StockfishLevelKey): void;
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
  randomness: getRandomness(),
  opponent: getOpponent(),
  stockfishLevel: getStockfishLevel(),
  // NATO by default: b/c/d/e/g are indistinguishable as bare letters.
  fileNaming: getFileNaming() ?? "letters",
  speechMode: getSpeechMode() ?? "on",
  boardFlipOverride: null,
  theme: initialTheme(),
  showTicker: getShowTicker(),
  assistMode: getAssistMode(),
  toggleTicker: () => {
    const next = !get().showTicker;
    persistShowTicker(next);
    set({ showTicker: next });
  },
  setAssistMode: (mode) => {
    persistAssistMode(mode);
    set({ assistMode: mode });
  },
  setPlayerColor: (color) => set({ playerColor: color, boardFlipOverride: null }),
  setRandomness: (stop) => {
    persistRandomness(stop);
    set({ randomness: stop });
  },
  setOpponent: (opponent) => {
    persistOpponent(opponent);
    set({ opponent });
  },
  setStockfishLevel: (level) => {
    persistStockfishLevel(level);
    set({ stockfishLevel: level });
  },
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
