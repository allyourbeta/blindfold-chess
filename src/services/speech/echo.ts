import { normalizeTranscript } from "./normalize";
import { similarity } from "./match";

/**
 * How close a transcript must be to something the app itself said (after
 * both are normalized) before it's discarded as an echo. Tuned against real
 * captures: "phone E6 is not legal" scores 0.71 against the rejection phrase
 * it echoed, "sorry I did not catch that" scores 1.0 against its clip, while
 * genuine moves score below 0.17 against any remembered sentence.
 */
const ECHO_SIMILARITY = 0.6;

/** Clip ids ("nato-e", "not-legal") and punctuation → sayable words, then the shared normalizer. */
function normalizeForEcho(text: string): string {
  return normalizeTranscript(text.replace(/nato-([a-h])\b/g, "$1").replace(/[-,.!?']/g, " "));
}

/**
 * True when a heard transcript is really the app's own voice output picked
 * up by the microphone.
 *
 * Compared only against remembered sentence phrases (rejections, "didn't
 * catch that", game end) — never against move announcements. Moves are short
 * and move-shaped, so matching against them would swallow real replies: the
 * player saying "knight d5" right after the app announced "knight f6" scores
 * 0.7 similarity. Echoes of move announcements are caught by the post-speech
 * grace window in useSpeechRecognition instead.
 */
export function isOwnEcho(transcript: string, recentSpokenTexts: string[]): boolean {
  const heard = normalizeForEcho(transcript);
  if (!heard) return false;
  return recentSpokenTexts.some(
    (spoken) => similarity(heard, normalizeForEcho(spoken)) >= ECHO_SIMILARITY,
  );
}
