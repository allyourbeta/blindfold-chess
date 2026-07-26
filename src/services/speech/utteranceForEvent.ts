import type { GameAudioEvent, MoveSource } from "@/state/gameStore";
import type { FileNaming, SpeechMode } from "@/api/localStore";
import { movePhraseClips, gameEndPhraseClips, rejectionPhraseClips } from "./phrase";
import { PIECE_WORDS } from "../chess/san";

export type ToneKind = "move" | "capture" | "error" | null;

export interface SpokenUtterance {
  tone: ToneKind;
  clips: string[] | null;
  text: string;
  /** Whether the echo filter should remember this text — see echo.ts. */
  remember: boolean;
}

export interface UtteranceDecision {
  /** null means: nothing should be enqueued for this event. */
  utterance: SpokenUtterance | null;
  /** Next value to carry forward as the not-understood loop breaker. */
  spokeNotUnderstoodLast: boolean;
}

/**
 * In "both" mode your own move is read back only when you spoke it — a typed
 * move needs no confirmation, since you already know what you typed.
 */
function shouldSpeakMove(by: "player" | "engine", source: MoveSource | null, mode: SpeechMode): boolean {
  if (mode === "silent") return false;
  if (by === "engine") return true;
  return mode === "both" && source?.kind === "voice";
}

/**
 * Pure event→utterance decision, extracted out of useSpeechOutput.ts so the
 * tone-suppression rule (no beeps outside Silent mode) can be unit tested
 * without a React effect or a live AudioContext. Tones here are the intent
 * the event carries; the actual play-time gate against a mode switched
 * mid-queue lives in useSpeechOutput's drainQueue.
 */
export function utteranceForEvent(
  event: GameAudioEvent,
  speechMode: SpeechMode,
  fileNaming: FileNaming,
  spokeNotUnderstoodLast: boolean,
): UtteranceDecision {
  // Beeps exist for Silent mode, where they're the only audio feedback. In
  // speaking modes the voice is the confirmation and the beep is just a
  // collision waiting to happen — so no tones there at all.
  const tonesOn = speechMode === "silent";

  if (event.kind === "move") {
    const tone: ToneKind = tonesOn ? (event.move.isCapture() ? "capture" : "move") : null;
    if (shouldSpeakMove(event.by, event.source, speechMode)) {
      const clips = movePhraseClips(event.move, fileNaming);
      return { utterance: { tone, clips, text: clips.join(" "), remember: false }, spokeNotUnderstoodLast: false };
    }
    if (tone) {
      return { utterance: { tone, clips: null, text: "", remember: false }, spokeNotUnderstoodLast: false };
    }
    return { utterance: null, spokeNotUnderstoodLast: false };
  }

  if (event.kind === "illegal-move") {
    // A rejected voice move always speaks, even in Silent mode: if you're
    // playing by voice you may not be watching the screen, and silence is
    // indistinguishable from the move having been accepted. Typed rejections
    // stay quiet — the message log has it and you're already looking.
    if (event.source.kind === "voice") {
      return {
        utterance: { tone: tonesOn ? "error" : null, clips: null, text: event.spoken, remember: true },
        spokeNotUnderstoodLast: false,
      };
    }
    if (tonesOn) {
      return { utterance: { tone: "error", clips: null, text: "", remember: false }, spokeNotUnderstoodLast: false };
    }
    return { utterance: null, spokeNotUnderstoodLast: false };
  }

  if (event.kind === "rejected-move") {
    // Always spoken, even in Silent mode — see the illegal-move note above.
    if (event.source.kind === "voice") {
      const clips = rejectionPhraseClips(PIECE_WORDS[event.piece], event.to, event.reason, fileNaming);
      return {
        utterance: { tone: tonesOn ? "error" : null, clips, text: clips.join(" "), remember: true },
        spokeNotUnderstoodLast: false,
      };
    }
    if (tonesOn) {
      return { utterance: { tone: "error", clips: null, text: "", remember: false }, spokeNotUnderstoodLast: false };
    }
    return { utterance: null, spokeNotUnderstoodLast: false };
  }

  if (event.kind === "not-understood") {
    if (spokeNotUnderstoodLast) {
      // Loop breaker: drop the repeated sentence (beep only, Silent mode only).
      if (tonesOn) {
        return { utterance: { tone: "error", clips: null, text: "", remember: false }, spokeNotUnderstoodLast: true };
      }
      return { utterance: null, spokeNotUnderstoodLast: true };
    }
    return {
      utterance: {
        tone: tonesOn ? "error" : null,
        clips: ["not-understood"],
        text: "Sorry, I did not catch that.",
        remember: true,
      },
      spokeNotUnderstoodLast: true,
    };
  }

  // game-end
  // Silent mode has no spoken narration for the reason, but still gets a
  // tone — otherwise the game ending would produce no feedback at all there.
  if (speechMode !== "silent") {
    const clips = gameEndPhraseClips(event.reason);
    return { utterance: { tone: null, clips, text: clips.join(" "), remember: true }, spokeNotUnderstoodLast: false };
  }
  if (tonesOn) {
    return { utterance: { tone: "move", clips: null, text: "", remember: false }, spokeNotUnderstoodLast: false };
  }
  return { utterance: null, spokeNotUnderstoodLast: false };
}
