import type { Move } from "chess.js";
import { movePhraseParts, type SpokenPart } from "../chess/san";
import type { GameEndReason } from "../chess/gameSummary";
import type { FileNaming } from "@/api/localStore";

/** NATO file clips, generated alongside the plain letter clips. */
export type NatoFileClip = `nato-${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}`;

/** Audio clip id — matches a filename in public/audio/<id>.wav. */
export type ClipId = SpokenPart | NatoFileClip;

const FILE_PARTS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
type FilePart = (typeof FILE_PARTS)[number];

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
 * A rejected spoken move, as clips: "knight d four is not legal".
 * Built the same way as a played move so it uses the same voice.
 */
export function rejectionPhraseClips(
  piece: SpokenPart,
  to: string,
  reason: "illegal" | "ambiguous",
  fileNaming: FileNaming = "letters",
): ClipId[] {
  const file = to[0] as FilePart;
  const rank = to[1] as SpokenPart;
  const fileClip: ClipId = fileNaming === "nato" ? (`nato-${file}` as NatoFileClip) : file;
  return [piece, fileClip, rank, reason === "ambiguous" ? "ambiguous" : "not-legal"];
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
