/** Browser helpers for the Web Speech API. */

const nav = typeof navigator === "undefined" ? null : navigator;
const win = typeof window === "undefined" ? null : window;

export const IS_IOS =
  !!nav &&
  (/iP(hone|od|ad)/.test(nav.userAgent) ||
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1));

export const IS_STANDALONE_WEB_APP =
  win?.matchMedia?.("(display-mode: standalone)").matches === true ||
  (nav as (Navigator & { standalone?: boolean }) | null)?.standalone === true;

export const IS_IOS_STANDALONE = IS_IOS && IS_STANDALONE_WEB_APP;

export function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (!win) return null;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export interface RecognitionAlternatives {
  alternatives: string[];
  isFinal: boolean;
}

/** Returns the alternatives from the newest result, including interim results. */
export function latestRecognitionAlternatives(event: SpeechRecognitionEvent): RecognitionAlternatives | null {
  if (!event.results.length) return null;
  const last = event.results[event.results.length - 1];
  if (!last) return null;
  const alternatives: string[] = [];
  for (let i = 0; i < last.length; i++) {
    const transcript = last[i]?.transcript?.trim();
    if (transcript) alternatives.push(transcript);
  }
  return alternatives.length ? { alternatives, isFinal: last.isFinal } : null;
}

export function tapRecognitionErrorMessage(error: string): string {
  if (error === "no-speech") return "I didn't hear a move. Tap the microphone and try again.";
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Voice input is blocked. Allow microphone and speech-recognition access, then try again.";
  }
  if (IS_IOS_STANDALONE) {
    return "The iPhone Home Screen app did not return speech. Open the site in Safari for voice moves.";
  }
  return `Voice input failed (${error}). Tap the microphone and try again.`;
}
