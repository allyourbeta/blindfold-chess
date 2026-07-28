import type { Move } from "chess.js";
import { movePhraseParts, PIECE_WORDS, type SpokenPart } from "../chess/san";
import type { GameEndReason } from "../chess/gameSummary";
import type { FileNaming } from "@/api/localStore";

/** NATO file clips, generated alongside the plain letter clips. */
export type NatoFileClip = `nato-${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}`;

/** Audio clip id — matches a filename in public/audio/<id>.wav. */
export type ClipId = SpokenPart | NatoFileClip;

const FILE_PARTS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
type FilePart = (typeof FILE_PARTS)[number];
const RANK_PARTS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;
const NATO_FILE_PARTS = FILE_PARTS.map((f) => `nato-${f}` as NatoFileClip);

// Every non-piece, non-square "connector" word a move, rejection, or game-end
// phrase can use. Kept in sync by scripts/generate-speech-clips.sh, which
// generates exactly these ids plus the pieces/files/ranks/nato below.
const SPECIAL_PARTS: SpokenPart[] = [
  "takes",
  "from",
  "check",
  "checkmate",
  "castles-kingside",
  "castles-queenside",
  "promotes-to",
  "en-passant",
  "stalemate",
  "draw",
  "not-legal",
];

/**
 * Every audio clip id the app can ever play — the full ClipId space, derived
 * from the same constants the phrase builders use rather than a separately
 * maintained list, so it can't silently drift from what those builders emit.
 */
export const CLIP_IDS: ClipId[] = [
  ...Object.values(PIECE_WORDS),
  ...FILE_PARTS,
  ...RANK_PARTS,
  ...NATO_FILE_PARTS,
  ...SPECIAL_PARTS,
];

const CLIP_SPEECH_TEXT: Partial<Record<ClipId, string>> = {
  "nato-a": "alpha",
  "nato-b": "bravo",
  "nato-c": "charlie",
  "nato-d": "delta",
  "nato-e": "echo",
  "nato-f": "foxtrot",
  "nato-g": "golf",
  "nato-h": "hotel",
  "castles-kingside": "castles kingside",
  "castles-queenside": "castles queenside",
  "promotes-to": "promotes to",
  "en-passant": "en passant",
  "not-legal": "is not legal",
};

/** Human-readable text for native speech synthesis; never exposes clip filenames. */
export function speechTextForClips(ids: readonly ClipId[]): string {
  return ids.map((id) => CLIP_SPEECH_TEXT[id] ?? id).join(" ");
}

function isFilePart(part: SpokenPart): part is FilePart {
  return (FILE_PARTS as readonly string[]).includes(part);
}

/**
 * A verbose chess.js move → the ordered clip ids to play for it.
 *
 * In NATO mode the file letters — and only the file letters — are swapped for
 * their phonetic-alphabet clips. Bare b/c/d/e/g are near-indistinguishable
 * spoken aloud; alpha/bravo/charlie were designed not to be. Ranks are digits
 * and were never ambiguous, so they are left alone.
 */
export function movePhraseClips(move: Move, fileNaming: FileNaming = "letters"): ClipId[] {
  const parts = movePhraseParts(move);
  if (fileNaming !== "nato") return parts;
  return parts.map((part) => (isFilePart(part) ? (`nato-${part}` as NatoFileClip) : part));
}

/**
 * Extra clips to play once a game ends. Checkmate is already carried by the
 * mating move's own "checkmate" clip, so it adds nothing further here.
 */
export function gameEndPhraseClips(reason: GameEndReason): ClipId[] {
  switch (reason) {
    case "stalemate":
      return ["stalemate"];
    case "threefold-repetition":
    case "insufficient-material":
    case "fifty-move-rule":
      return ["draw"];
    case "checkmate":
    case "resignation":
      return [];
  }
}
