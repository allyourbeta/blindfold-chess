import type { GameAudioEvent } from "@/state/gameStore";
import type { FileNaming, SpeechMode } from "@/api/localStore";
import { movePhraseClips, gameEndPhraseClips, speechTextForClips, type ClipId } from "./phrase";

const PIECE_CLIP: Record<string, ClipId> = { N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };

/**
 * Speaks a rejected keypad entry back as "<what you stated>, not legal".
 * The attempted text is our own buildSanFromSlots output, so its shape is
 * fully regular; anything else (defensive) is simply not spoken.
 */
function rejectionClips(attempted: string, fileNaming: FileNaming): ClipId[] | null {
  if (attempted === "O-O") return ["castles-kingside", "not-legal"];
  if (attempted === "O-O-O") return ["castles-queenside", "not-legal"];
  const m = attempted.match(/^([NBRQK])?([a-h])([1-8])$/);
  if (!m) return null;
  const [, piece, file, rank] = m;
  const fileClip = (fileNaming === "nato" ? `nato-${file}` : file) as ClipId;
  return [...(piece ? [PIECE_CLIP[piece]] : []), fileClip, rank as ClipId, "not-legal"];
}

export interface SpokenUtterance {
  clips: string[] | null;
  text: string;
}

/**
 * Pure event-to-voice decision. The application generates no beeps.
 *
 * Player moves never speak — typed/keypad moves never read back by design.
 * Illegal ENTRIES do speak ("knight f six, not legal"): in strict mode the
 * rejection is the app's whole answer, and a blindfolded player must hear
 * it — a silent log line reads as a freeze.
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

  if (event.kind === "illegal-move") {
    if (!event.attempted) return null;
    const clips = rejectionClips(event.attempted, fileNaming);
    if (!clips) return null;
    return { clips, text: speechTextForClips(clips) };
  }

  const clips = gameEndPhraseClips(event.reason);
  if (!clips.length) return null;
  return { clips, text: speechTextForClips(clips) };
}
