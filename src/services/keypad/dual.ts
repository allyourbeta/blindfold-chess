/**
 * Novag-style dual keys: each of the eight square keys carries one file AND
 * one rank (a1, b2, … h8). The rule is the Sapphire II's own, and it is
 * absolute: within a square, the first tap is the letter, the second is the
 * number. Every entry names a destination square — pawn captures included —
 * so a dual key is NEVER two-way: a file is readable only while the entry
 * has no destination file, a rank only after it has one. Which piece (or
 * which pawn) makes the move is resolved from the position at submission,
 * with the standard SAN chooser when two candidates remain.
 */

import {
  candidatesFor,
  reduceTaps,
  type AssistLevel,
  type FileLetter,
  type LegalMove,
  type RankDigit,
  type Tap,
} from "./entry";

export type DualReading = "file" | "rank" | "none";

export function interpretDualTap(
  legalMoves: readonly LegalMove[],
  taps: readonly Tap[],
  file: FileLetter,
  rank: RankDigit,
  assist: AssistLevel = "assisted",
): DualReading {
  const slots = reduceTaps(taps);
  if (slots.committed === "castle") return "none";

  if (slots.destFile === null) {
    // Strict piece-first: a square tap means nothing until a piece opens the entry.
    if (assist === "strict" && slots.committed === null) return "none";
    if (assist === "assisted" && candidatesFor(legalMoves, [...taps, { kind: "file", value: file }]).length === 0) {
      return "none";
    }
    return "file";
  }

  if (slots.destRank !== null) return "none";
  if (assist === "assisted" && candidatesFor(legalMoves, [...taps, { kind: "rank", value: rank }]).length === 0) {
    return "none";
  }
  return "rank";
}
