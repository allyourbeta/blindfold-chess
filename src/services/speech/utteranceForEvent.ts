import type { GameAudioEvent } from "@/state/gameStore";
import type { FileNaming, SpeechMode } from "@/api/localStore";
import { movePhraseClips, gameEndPhraseClips, speechTextForClips } from "./phrase";

export interface SpokenUtterance {
  clips: string[] | null;
  text: string;
}

/**
 * Pure event-to-voice decision. The application generates no beeps.
 *
 * Player moves never speak — there is no voice input to read back, and
 * typed/keypad moves never read back by design. Illegal-move attempts are
 * shown in the message log, never spoken, for the same reason.
 */
export function utteranceForEvent(
  event: GameAudioEvent,
  speechMode: SpeechMode,
  fileNaming: FileNaming,
): SpokenUtterance | null {
  if (speechMode === "off") return null;

  if (event.kind === "move") {
    if (event.by !== "engine") return null;
    const clips = movePhraseClips(event.move, fileNaming);
    return { clips, text: speechTextForClips(clips) };
  }

  if (event.kind === "illegal-move") return null;

  const clips = gameEndPhraseClips(event.reason);
  if (!clips.length) return null;
  return { clips, text: speechTextForClips(clips) };
}
