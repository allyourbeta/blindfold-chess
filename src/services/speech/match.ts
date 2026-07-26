import type { Chess, Move, PieceSymbol } from "chess.js";
import { generateMoveCandidates } from "./candidates";
import { moveGrammar, type GrammarEntry } from "./grammar";
import { normalizeTranscript } from "./normalize";

export type VoiceCommand = "peek" | "takeback" | "resign" | "hint" | "new-game";

export type TranscriptMatch =
  | { type: "command"; command: VoiceCommand; confidence: number }
  | { type: "move"; move: Move; confidence: number }
  /** Understood as a move, but not playable. Nothing is played. */
  | { type: "rejected"; label: string; piece: PieceSymbol; to: string; reason: "illegal" | "ambiguous"; confidence: number }
  | { type: "none"; heard: string };

// Commands need a higher bar than moves — "e4" must never turn into "resign".
const MOVE_MATCH_THRESHOLD = 0.55;
/**
 * Only meant to catch genuine ties — two legal moves whose spoken forms are
 * literally identical, like either knight capturing on d5. It stays small on
 * purpose: neighbouring files differ by a single character, so "knight to f3"
 * and "knight to c3" sit well under 0.1 apart and a wider margin would reject
 * ordinary moves. Mishearings are caught by the grammar below, not here.
 */
const MOVE_AMBIGUITY_MARGIN = 0.03;
/** Saying an illegal move out loud should score near 1.0 against the grammar. */
const GRAMMAR_MATCH_THRESHOLD = 0.72;
const COMMAND_MATCH_THRESHOLD = 0.72;

const COMMAND_PHRASES: Record<VoiceCommand, string[]> = {
  peek: ["peek", "peak"],
  takeback: ["take back", "takeback", "undo"],
  resign: ["resign", "i resign"],
  hint: ["hint", "help", "moves", "show hint"],
  "new-game": ["new game", "restart", "start over"],
};

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, row[j], row[j - 1]);
      prevDiag = tmp;
    }
  }
  return row[b.length];
}

/** Character-level similarity in [0, 1], normalized by the longer string's length. */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function bestCommandMatch(transcript: string): { command: VoiceCommand; confidence: number } | null {
  let best: VoiceCommand | null = null;
  let bestScore = -1;
  for (const [command, phrases] of Object.entries(COMMAND_PHRASES) as [VoiceCommand, string[]][]) {
    for (const phrase of phrases) {
      const score = similarity(transcript, phrase);
      if (score > bestScore) {
        bestScore = score;
        best = command;
      }
    }
  }
  return best && bestScore >= COMMAND_MATCH_THRESHOLD ? { command: best, confidence: bestScore } : null;
}

function bestMoveMatch(chess: Chess, transcript: string): { move: Move; confidence: number } | null {
  let bestMove: Move | null = null;
  let bestScore = -1;
  let secondBestScore = -1;

  for (const move of chess.moves({ verbose: true })) {
    let moveScore = -1;
    for (const candidate of generateMoveCandidates(move)) {
      moveScore = Math.max(moveScore, similarity(transcript, candidate));
    }
    if (moveScore > bestScore) {
      secondBestScore = bestScore;
      bestScore = moveScore;
      bestMove = move;
    } else if (moveScore > secondBestScore) {
      secondBestScore = moveScore;
    }
  }

  if (!bestMove || bestScore < MOVE_MATCH_THRESHOLD) return null;
  // Two distinct legal moves are too close to call — don't guess, ask instead.
  if (secondBestScore >= 0 && bestScore - secondBestScore < MOVE_AMBIGUITY_MARGIN) return null;
  return { move: bestMove, confidence: bestScore };
}

function bestGrammarMatch(transcript: string): { entry: GrammarEntry; confidence: number } | null {
  let bestEntry: GrammarEntry | null = null;
  let bestScore = -1;

  for (const entry of moveGrammar()) {
    for (const phrase of entry.phrases) {
      const score = similarity(transcript, phrase);
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }
  }

  return bestEntry && bestScore >= GRAMMAR_MATCH_THRESHOLD ? { entry: bestEntry, confidence: bestScore } : null;
}

/**
 * Commands first, then moves.
 *
 * Moves are scored twice: once against the legal moves available right now,
 * and once against the grammar of every sayable piece-to-square move. A legal
 * move's own phrasings are a superset of its grammar entry, so a legal move
 * always wins ties. When the grammar wins outright, the player said something
 * coherent that simply isn't legal — and is told so rather than having the
 * nearest legal move played for them.
 */
export function matchTranscript(chess: Chess, normalizedTranscript: string): TranscriptMatch {
  if (!normalizedTranscript) return { type: "none", heard: normalizedTranscript };

  const command = bestCommandMatch(normalizedTranscript);
  if (command) return { type: "command", ...command };

  const legal = bestMoveMatch(chess, normalizedTranscript);
  const grammar = bestGrammarMatch(normalizedTranscript);

  if (legal && (!grammar || legal.confidence >= grammar.confidence)) {
    return { type: "move", ...legal };
  }

  if (grammar) {
    const { entry, confidence } = grammar;
    const fits = chess.moves({ verbose: true }).filter((m) => m.piece === entry.piece && m.to === entry.to);
    // Exactly one legal move fits what was said — play it, even though the
    // legal-candidate pass wasn't confident enough to pick it on its own.
    if (fits.length === 1) return { type: "move", move: fits[0], confidence };
    const reason = fits.length > 1 ? "ambiguous" : "illegal";
    return { type: "rejected", label: entry.label, piece: entry.piece, to: entry.to, reason, confidence };
  }

  return { type: "none", heard: normalizedTranscript };
}

/**
 * Scores every recognition alternative (not just the first) and returns the
 * single best match across all of them, per spec §7.2.
 */
export function matchBestAlternative(chess: Chess, rawAlternatives: string[]): TranscriptMatch {
  let best: TranscriptMatch = { type: "none", heard: "" };
  let bestConfidence = -1;

  for (const raw of rawAlternatives) {
    const normalized = normalizeTranscript(raw);
    const result = matchTranscript(chess, normalized);
    const confidence = result.type === "none" ? 0 : result.confidence;
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      best = result.type === "none" ? { type: "none", heard: raw.trim() } : result;
    }
  }

  return best;
}
