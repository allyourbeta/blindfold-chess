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

  // Dual keys keep strict alternation: first tap in a square is the file,
  // second is the rank. Replacement (typing "cxd4" on a keyboard) is NOT
  // available here — after a file is set there is no way for a dual key to
  // signal "another file", so the second tap must be the rank. What did
  // change: a bare file now starts a pawn move, with no pawn key first.
  if (slots.destFile === null) {
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
