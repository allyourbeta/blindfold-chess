import type { StoredGame } from "@/services/chess/gameSummary";

/**
 * The only module in the codebase allowed to touch localStorage. Everything
 * else — state stores included — goes through the functions here.
 */

const HISTORY_KEY = "blindfoldHistory";
const THEME_KEY = "blindfoldTheme";
const FILE_NAMING_KEY = "blindfoldFileNaming";
const SPEECH_MODE_KEY = "blindfoldSpeechMode";
const MAX_HISTORY = 100;

export function getGameHistory(): StoredGame[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as StoredGame[]) : [];
  } catch {
    return [];
  }
}

/** Appends a finished game, keeping only the most recent 100 — same shape/limit as the original app. */
export function saveGameToHistory(entry: StoredGame): void {
  try {
    const history = getGameHistory();
    history.push(entry);
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Private-mode / quota-exceeded localStorage — history just won't persist.
  }
}

export type ThemePreference = "light" | "dark";

export function getThemePreference(): ThemePreference | null {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

export function setThemePreference(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore — theme just won't persist across reloads
  }
}

/** How spoken file letters are pronounced: "e four" vs "echo four". */
export type FileNaming = "letters" | "nato";

export function getFileNaming(): FileNaming | null {
  try {
    const raw = localStorage.getItem(FILE_NAMING_KEY);
    return raw === "letters" || raw === "nato" ? raw : null;
  } catch {
    return null;
  }
}

export function setFileNaming(mode: FileNaming): void {
  try {
    localStorage.setItem(FILE_NAMING_KEY, mode);
  } catch {
    // ignore — preference just won't persist across reloads
  }
}

/**
 * How much the app says out loud.
 *   silent — nothing is spoken; you read the moves on screen
 *   engine — the engine's moves only
 *   both   — the engine's moves, and your own spoken move read back
 */
export type SpeechMode = "silent" | "engine" | "both";

export function getSpeechMode(): SpeechMode | null {
  try {
    const raw = localStorage.getItem(SPEECH_MODE_KEY);
    return raw === "silent" || raw === "engine" || raw === "both" ? raw : null;
  } catch {
    return null;
  }
}

export function setSpeechMode(mode: SpeechMode): void {
  try {
    localStorage.setItem(SPEECH_MODE_KEY, mode);
  } catch {
    // ignore — preference just won't persist across reloads
  }
}
