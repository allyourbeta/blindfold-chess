/**
 * Pure state machine for the in-app move keypad. No React, no DOM, no
 * chess.js import — callers pass the position's legal moves as plain data
 * (chess.js verbose move objects satisfy `LegalMove` structurally) and the
 * sequence of keys tapped so far; this module derives everything the keypad
 * needs to render from those two inputs alone.
 */

export type PieceLetter = "N" | "B" | "R" | "Q" | "K" | "P";
export type FileLetter = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
export type RankDigit = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type CastleValue = "O-O" | "O-O-O";

export type Tap =
  | { kind: "piece"; value: PieceLetter }
  | { kind: "file"; value: FileLetter }
  | { kind: "rank"; value: RankDigit }
  | { kind: "castle"; value: CastleValue };

/** Structural subset of a chess.js verbose Move — kept minimal so this file never imports chess.js. */
export interface LegalMove {
  san: string;
  piece: "p" | "n" | "b" | "r" | "q" | "k";
  from: string;
  to: string;
  promotion?: string;
}

export interface EnabledKeys {
  pieces: Record<PieceLetter, boolean>;
  files: Record<FileLetter, boolean>;
  ranks: Record<RankDigit, boolean>;
  castleKingside: boolean;
  castleQueenside: boolean;
}

export type AssistLevel = "assisted" | "strict";

export interface EntryState {
  preview: string;
  enabled: EnabledKeys;
  candidates: LegalMove[];
  resolved: LegalMove | null;
  disambiguation: string[] | null;
  promotionPending: boolean;
  /** Strict mode only: a syntactically complete entry that matches no legal move — submit it so the rejection is spoken. */
  invalid: string | null;
}

/** Row order matches the keypad's Row 1 layout (♔ ♕ ♖ ♗ ♘). */
export const PIECE_LETTERS: readonly PieceLetter[] = ["K", "Q", "R", "B", "N", "P"];
export const FILE_LETTERS: readonly FileLetter[] = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const RANK_DIGITS: readonly RankDigit[] = ["1", "2", "3", "4", "5", "6", "7", "8"];

const PIECE_CHAR: Record<PieceLetter, LegalMove["piece"]> = {
  N: "n",
  B: "b",
  R: "r",
  Q: "q",
  K: "k",
  P: "p",
};

export interface Slots {
  committed: "piece" | "pawn" | "castle" | null;
  pieceLetter: PieceLetter | null;
  castle: CastleValue | null;
  originFile: FileLetter | null;
  destFile: FileLetter | null;
  destRank: RankDigit | null;
}

/**
 * Folds the tap sequence into named slots. A file tap is ambiguous on its
 * own — it means "pawn origin file" the first time one appears with no
 * piece committed, "piece destination file" right after a piece tap, and
 * "capture destination file" the second time it appears in a pawn entry.
 * Which one applies is decided here, once, rather than by tap position.
 */
export function reduceTaps(taps: readonly Tap[]): Slots {
  const slots: Slots = {
    committed: null,
    pieceLetter: null,
    castle: null,
    originFile: null,
    destFile: null,
    destRank: null,
  };

  taps.forEach((tap, i) => {
    if (i === 0) {
      if (tap.kind === "piece") slots.committed = tap.value === "P" ? "pawn" : "piece";
      else if (tap.kind === "castle") slots.committed = "castle";
      else if (tap.kind === "file") slots.committed = "pawn";
    }

    if (tap.kind === "castle") {
      slots.castle = tap.value;
    } else if (tap.kind === "piece") {
      slots.pieceLetter = tap.value === "P" ? null : tap.value;
    } else if (tap.kind === "file") {
      if (slots.committed === "piece") slots.destFile = tap.value;
      else if (slots.originFile === null) slots.originFile = tap.value;
      else slots.destFile = tap.value;
    } else if (tap.kind === "rank") {
      if (slots.destFile === null && slots.originFile !== null) slots.destFile = slots.originFile;
      slots.destRank = tap.value;
    }
  });

  return slots;
}

function matchesSlots(move: LegalMove, slots: Slots): boolean {
  if (slots.committed === "castle") return move.san === slots.castle;
  if (slots.committed === "piece") {
    if (move.piece !== PIECE_CHAR[slots.pieceLetter as PieceLetter]) return false;
  } else if (slots.committed === "pawn") {
    if (move.piece !== "p") return false;
  }
  if (slots.originFile && move.from[0] !== slots.originFile) return false;
  if (slots.destFile && move.to[0] !== slots.destFile) return false;
  if (slots.destRank && move.to[1] !== slots.destRank) return false;
  return true;
}

export function candidatesFor(legalMoves: readonly LegalMove[], taps: readonly Tap[]): LegalMove[] {
  const slots = reduceTaps(taps);
  return legalMoves.filter((m) => matchesSlots(m, slots));
}

/**
 * A pawn can never capture on its own file, so once a pawn entry has its
 * origin file, tapping that same file again means nothing — the second tap
 * on the d4 key after "d" must read as rank 4 (playing d4), never as a
 * phantom d-file "capture". Without this rule the file reading stayed alive
 * on the pawn's own pushes and every same-key pawn push opened a chooser.
 */
export function fileTapAccepted(taps: readonly Tap[], file: FileLetter): boolean {
  const slots = reduceTaps(taps);
  if (slots.committed === "pawn" && slots.destFile === null && slots.originFile === file) return false;
  return true;
}

function buildPreview(taps: readonly Tap[], terminal: boolean): string {
  if (taps.length === 0) return "";
  const shown = taps.map((t) => t.value as string);
  if (!terminal) shown.push("_");
  return shown.join(" ");
}

/**
 * Strict enablement reveals NOTHING about the position: keys follow the
 * grammar of the entry alone (a rank needs a file first; a piece or castle
 * only starts an entry; a pawn can't "capture" its own file). Dimming here
 * reflects what you've tapped, never what the position allows.
 */
function computeStrictEnabled(taps: readonly Tap[], terminal: boolean): EnabledKeys {
  const slots = reduceTaps(taps);
  const pieces = {} as Record<PieceLetter, boolean>;
  const files = {} as Record<FileLetter, boolean>;
  const ranks = {} as Record<RankDigit, boolean>;
  const atStart = taps.length === 0;
  const fileOpen =
    !terminal &&
    slots.committed !== "castle" &&
    (slots.committed === "piece" ? slots.destFile === null : slots.destFile === null);
  for (const p of PIECE_LETTERS) pieces[p] = atStart;
  for (const f of FILE_LETTERS) files[f] = !terminal && fileOpen && fileTapAccepted(taps, f);
  for (const r of RANK_DIGITS) {
    ranks[r] = !terminal && slots.destRank === null && taps.some((t) => t.kind === "file");
  }
  return { pieces, files, ranks, castleKingside: atStart, castleQueenside: atStart };
}

function buildSanFromSlots(slots: Slots): string {
  if (slots.committed === "castle") return slots.castle ?? "";
  if (slots.committed === "piece") return `${slots.pieceLetter}${slots.destFile}${slots.destRank}`;
  if (slots.originFile && slots.destFile && slots.originFile !== slots.destFile) {
    return `${slots.originFile}x${slots.destFile}${slots.destRank}`;
  }
  return `${slots.destFile}${slots.destRank}`;
}

function computeEnabled(legalMoves: readonly LegalMove[], taps: readonly Tap[], terminal: boolean): EnabledKeys {
  const pieces = {} as Record<PieceLetter, boolean>;
  const files = {} as Record<FileLetter, boolean>;
  const ranks = {} as Record<RankDigit, boolean>;

  if (terminal) {
    for (const p of PIECE_LETTERS) pieces[p] = false;
    for (const f of FILE_LETTERS) files[f] = false;
    for (const r of RANK_DIGITS) ranks[r] = false;
    return { pieces, files, ranks, castleKingside: false, castleQueenside: false };
  }

  const atStart = taps.length === 0;
  const fileEntered = taps.some((t) => t.kind === "file");

  for (const p of PIECE_LETTERS) {
    pieces[p] = atStart && legalMoves.some((m) => m.piece === PIECE_CHAR[p]);
  }
  for (const f of FILE_LETTERS) {
    files[f] =
      fileTapAccepted(taps, f) && candidatesFor(legalMoves, [...taps, { kind: "file", value: f }]).length > 0;
  }
  for (const r of RANK_DIGITS) {
    ranks[r] = fileEntered && candidatesFor(legalMoves, [...taps, { kind: "rank", value: r }]).length > 0;
  }

  return {
    pieces,
    files,
    ranks,
    castleKingside: atStart && legalMoves.some((m) => m.san === "O-O"),
    castleQueenside: atStart && legalMoves.some((m) => m.san === "O-O-O"),
  };
}

/**
 * Derives the full keypad state from the position's legal moves and the
 * taps entered so far. Auto-submit is literal: as soon as the tapped prefix
 * narrows the legal moves to exactly one, that move is `resolved` —
 * regardless of how many keys the entry scheme "normally" expects, so a
 * piece+file (or a pawn capture's two files) can resolve before its rank.
 */
export function computeEntryState(
  legalMoves: readonly LegalMove[],
  taps: readonly Tap[],
  assist: AssistLevel = "assisted",
): EntryState {
  const slots = reduceTaps(taps);
  const candidates = legalMoves.filter((m) => matchesSlots(m, slots));

  let resolved: LegalMove | null = null;
  let disambiguation: string[] | null = null;
  let promotionPending = false;
  let invalid: string | null = null;

  // Strict: nothing resolves early — an entry counts only once it's
  // syntactically complete (castle, or a destination rank stated).
  const complete = slots.committed === "castle" || slots.destRank !== null;

  if (assist === "assisted" ? taps.length > 0 && candidates.length === 1 : complete && candidates.length === 1) {
    resolved = candidates[0];
  } else if ((assist === "assisted" ? slots.destRank !== null : complete) && candidates.length > 1) {
    if (candidates.every((c) => c.promotion)) promotionPending = true;
    else disambiguation = candidates.map((c) => c.san);
  } else if (assist === "strict" && complete && candidates.length === 0) {
    invalid = buildSanFromSlots(slots);
  }

  const terminal = resolved !== null || disambiguation !== null || promotionPending || invalid !== null;

  return {
    preview: buildPreview(taps, terminal),
    enabled: assist === "strict" ? computeStrictEnabled(taps, terminal) : computeEnabled(legalMoves, taps, terminal),
    candidates,
    resolved,
    disambiguation,
    promotionPending,
    invalid,
  };
}
