/**
 * Novag-style dual keys: each of the eight square keys carries one file AND
 * one rank (a1, b2, … h8). A tap is read as whichever the entry can accept.
 *
 * Assisted: readings are checked against the legal moves, and the rare
 * genuinely two-way tap offers the actual moves ("e4" / "exd5").
 *
 * Strict: readings follow entry grammar alone — no legality peeking. The
 * two-way pawn tap still exists (after "e", the d4 key is either the d-file
 * capture or rank 4), but the chooser offers READINGS, not verified moves:
 * "e4" / "exd…". Whether the finished entry is legal is judged only at
 * submission, out loud.
 */

import {
  candidatesFor,
  fileTapAccepted,
  reduceTaps,
  type AssistLevel,
  type FileLetter,
  type LegalMove,
  type RankDigit,
  type Tap,
} from "./entry";

export type DualReading = "file" | "rank" | "both" | "none";

/** A strict two-way tap resolves through one of these: apply the tap the label describes. */
export interface StrictDualChoice {
  label: string;
  tap: Tap;
}

function assistedFileReadable(legalMoves: readonly LegalMove[], taps: readonly Tap[], file: FileLetter): boolean {
  if (!fileTapAccepted(taps, file)) return false;
  return candidatesFor(legalMoves, [...taps, { kind: "file", value: file }]).length > 0;
}

function assistedRankReadable(legalMoves: readonly LegalMove[], taps: readonly Tap[], rank: RankDigit): boolean {
  if (!taps.some((t) => t.kind === "file")) return false;
  return candidatesFor(legalMoves, [...taps, { kind: "rank", value: rank }]).length > 0;
}

function strictFileReadable(taps: readonly Tap[], file: FileLetter): boolean {
  const slots = reduceTaps(taps);
  if (slots.committed === "castle" || slots.destFile !== null) return false;
  return fileTapAccepted(taps, file);
}

function strictRankReadable(taps: readonly Tap[]): boolean {
  const slots = reduceTaps(taps);
  return slots.destRank === null && taps.some((t) => t.kind === "file");
}

export function interpretDualTap(
  legalMoves: readonly LegalMove[],
  taps: readonly Tap[],
  file: FileLetter,
  rank: RankDigit,
  assist: AssistLevel = "assisted",
): DualReading {
  const asFile =
    assist === "strict" ? strictFileReadable(taps, file) : assistedFileReadable(legalMoves, taps, file);
  const asRank = assist === "strict" ? strictRankReadable(taps) : assistedRankReadable(legalMoves, taps, rank);
  if (asFile && asRank) return "both";
  if (asFile) return "file";
  if (asRank) return "rank";
  return "none";
}

/** Assisted "both": SANs of every legal move reachable under either reading, file reading first, deduped. */
export function dualTapOptions(
  legalMoves: readonly LegalMove[],
  taps: readonly Tap[],
  file: FileLetter,
  rank: RankDigit,
): string[] {
  const sans: string[] = [];
  for (const tap of [
    { kind: "file", value: file } as Tap,
    { kind: "rank", value: rank } as Tap,
  ]) {
    for (const move of candidatesFor(legalMoves, [...taps, tap])) {
      if (!sans.includes(move.san)) sans.push(move.san);
    }
  }
  return sans;
}

/** Strict "both": the two grammatical readings of the tap, position unseen. */
export function strictDualChoices(taps: readonly Tap[], file: FileLetter, rank: RankDigit): StrictDualChoice[] {
  const slots = reduceTaps(taps);
  const origin = slots.originFile ?? "";
  return [
    { label: `${origin}${rank}`, tap: { kind: "rank", value: rank } },
    { label: `${origin}x${file}…`, tap: { kind: "file", value: file } },
  ];
}
