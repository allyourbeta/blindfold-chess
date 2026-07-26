import type { GameAudioEvent, MoveSource } from "@/state/gameStore";
import type { FileNaming, SpeechMode } from "@/api/localStore";
import { movePhraseClips, gameEndPhraseClips, rejectionPhraseClips } from "./phrase";
import { PIECE_WORDS } from "../chess/san";

export interface SpokenUtterance {
  clips: string[] | null;
  text: string;
  /** Whether the echo filter should remember this text — see echo.ts. */
  remember: boolean;
}

export interface UtteranceDecision {
  utterance: SpokenUtterance | null;
  spokeNotUnderstoodLast: boolean;
}

function shouldSpeakMove(by: "player" | "engine", source: MoveSource | null, mode: SpeechMode): boolean {
  if (mode === "silent") return false;
  if (by === "engine") return true;
  return mode === "both" && source?.kind === "voice";
}

/** Pure event-to-voice decision. The application generates no beeps. */
export function utteranceForEvent(
  event: GameAudioEvent,
  speechMode: SpeechMode,
  fileNaming: FileNaming,
  spokeNotUnderstoodLast: boolean,
): UtteranceDecision {
  if (event.kind === "move") {
    if (!shouldSpeakMove(event.by, event.source, speechMode)) {
      return { utterance: null, spokeNotUnderstoodLast: false };
    }
    const clips = movePhraseClips(event.move, fileNaming);
    return { utterance: { clips, text: clips.join(" "), remember: false }, spokeNotUnderstoodLast: false };
  }

  if (event.kind === "illegal-move") {
    if (event.source.kind !== "voice") return { utterance: null, spokeNotUnderstoodLast: false };
    return {
      utterance: { clips: null, text: event.spoken, remember: true },
      spokeNotUnderstoodLast: false,
    };
  }

  if (event.kind === "rejected-move") {
    if (event.source.kind !== "voice") return { utterance: null, spokeNotUnderstoodLast: false };
    const clips = rejectionPhraseClips(PIECE_WORDS[event.piece], event.to, event.reason, fileNaming);
    return {
      utterance: { clips, text: clips.join(" "), remember: true },
      spokeNotUnderstoodLast: false,
    };
  }

  if (event.kind === "not-understood") {
    if (spokeNotUnderstoodLast) return { utterance: null, spokeNotUnderstoodLast: true };
    return {
      utterance: {
        clips: ["not-understood"],
        text: "Sorry, I did not catch that.",
        remember: true,
      },
      spokeNotUnderstoodLast: true,
    };
  }

  if (speechMode === "silent") return { utterance: null, spokeNotUnderstoodLast: false };
  const clips = gameEndPhraseClips(event.reason);
  if (!clips.length) return { utterance: null, spokeNotUnderstoodLast: false };
  return { utterance: { clips, text: clips.join(" "), remember: true }, spokeNotUnderstoodLast: false };
}
