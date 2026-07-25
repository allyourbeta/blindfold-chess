import { Chess } from "chess.js";

export type MoveResolution = { ok: true; san: string } | { ok: false; error: string };

const DESCRIPTIVE_RE = /^[pnbrqk]x[pnbrqk]$/i;

/** NF3→Nf3, E4→e4, BXE5→Bxe5, castling variants (0-0/o-o)→O-O. */
export function normalizeMoveInput(raw: string): string {
  let move = raw.trim();
  move = move.replace(/^[oO0]-[oO0]-[oO0]$/, "O-O-O").replace(/^[oO0]-[oO0]$/, "O-O");
  if (move !== "O-O" && move !== "O-O-O") {
    move = move.replace(/^([NBRQK]?)(.+)$/, (_m, piece, rest) => (piece || "") + rest.toLowerCase());
    if (/^[nbrqk]/i.test(move) && move.length >= 3) {
      const first = move[0].toUpperCase();
      if ("NBRQK".includes(first)) move = first + move.slice(1).toLowerCase();
    }
  }
  return move;
}

/** "pxp"/"qxb"/"nxr" — the piece that can capture a given piece type, only when unambiguous. */
export function resolveDescriptiveMove(chess: Chess, desc: string): string | null {
  const match = desc.toLowerCase().match(/^([pnbrqk])x([pnbrqk])$/);
  if (!match) return null;
  const [, attackerType, targetType] = match;
  const candidates = chess
    .moves({ verbose: true })
    .filter((m) => m.piece === attackerType && m.captured === targetType);
  return candidates.length === 1 ? candidates[0].san : null;
}

/** Case-insensitive exact/prefix match, plus a few missing-rank shorthands, against the legal move list. */
export function resolvePartialMove(chess: Chess, partial: string): string | null {
  const moves = chess.moves();
  const p = partial.toLowerCase();

  const exact = moves.find((m) => m.toLowerCase() === p);
  if (exact) return exact;

  const startsWith = moves.filter((m) => m.toLowerCase().startsWith(p));
  if (startsWith.length === 1) return startsWith[0];

  const captureNoRank = p.match(/^([a-h])x([a-h])$/);
  if (captureNoRank) {
    const [, fromFile, toFile] = captureNoRank;
    const matches = moves.filter((m) => {
      const ml = m.toLowerCase();
      return ml.startsWith(fromFile) && ml.includes("x") && ml.includes(toFile);
    });
    if (matches.length === 1) return matches[0];
  }

  const pieceFile = p.match(/^([nbrqk])([a-h])$/);
  if (pieceFile) {
    const [, piece, file] = pieceFile;
    const matches = moves.filter((m) => m[0].toLowerCase() === piece && m.toLowerCase().includes(file));
    if (matches.length === 1) return matches[0];
  }

  return null;
}

/** UCI, phonetic garbage, and partial destinations — last resort before rejecting the input. */
export function fuzzyMatchMove(chess: Chess, parsed: string): string | null {
  if (!parsed) return null;
  const moves = chess.moves({ verbose: true });
  const p = parsed.toLowerCase().replace(/[+#]/g, "");

  const exactSan = moves.find((m) => m.san.toLowerCase().replace(/[+#]/g, "") === p);
  if (exactSan) return exactSan.san;

  if (/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(p)) {
    const from = p.slice(0, 2);
    const to = p.slice(2, 4);
    const promo = p[4] || undefined;
    const uciMatch = moves.find((m) => m.from === from && m.to === to && (!promo || m.promotion === promo));
    if (uciMatch) return uciMatch.san;
  }

  const startMatches = moves.filter((m) => m.san.toLowerCase().replace(/[+#]/g, "").startsWith(p));
  if (startMatches.length === 1) return startMatches[0].san;

  if (/^[a-h][1-8]$/.test(p)) {
    const destMatches = moves.filter((m) => m.to === p && m.piece === "p");
    if (destMatches.length === 1) return destMatches[0].san;
  }

  const pdMatch = p.match(/^([nbrqk])([a-h][1-8])$/);
  if (pdMatch) {
    const [, piece, dest] = pdMatch;
    const matches = moves.filter((m) => m.piece === piece && m.to === dest);
    if (matches.length === 1) return matches[0].san;
  }

  const pcMatch = p.match(/^([nbrqk])x([a-h][1-8])$/);
  if (pcMatch) {
    const [, piece, dest] = pcMatch;
    const matches = moves.filter((m) => m.piece === piece && m.to === dest && m.captured);
    if (matches.length === 1) return matches[0].san;
  }

  const pawnCap = p.match(/^([a-h])x([a-h])([1-8])?$/);
  if (pawnCap) {
    const [, fromFile, toFile, rank] = pawnCap;
    const matches = moves.filter((m) => {
      if (m.piece !== "p" || !m.captured) return false;
      if (m.from[0] !== fromFile || m.to[0] !== toFile) return false;
      if (rank && m.to[1] !== rank) return false;
      return true;
    });
    if (matches.length === 1) return matches[0].san;
  }

  const destInNoise = p.match(/([a-h][1-8])/);
  if (destInNoise) {
    const dest = destInNoise[1];
    const matches = moves.filter((m) => m.to === dest);
    if (matches.length === 1) return matches[0].san;
  }

  return null;
}

/** Confirms a candidate SAN/UCI-ish string against a disposable clone — never mutates `chess`. */
function tryChessMove(chess: Chess, candidate: string): string | null {
  const probe = new Chess(chess.fen());
  try {
    return probe.move(candidate).san;
  } catch {
    return null;
  }
}

/**
 * Resolves arbitrary move text (standard SAN, descriptive captures, partial
 * input, or fuzzy garbage) against the legal moves of `chess`, without
 * mutating it. The caller applies the returned SAN with chess.move().
 */
export function resolveMoveInput(chess: Chess, rawInput: string): MoveResolution {
  const trimmed = rawInput.trim();
  if (!trimmed) return { ok: false, error: "" };

  if (DESCRIPTIVE_RE.test(trimmed)) {
    const resolved = resolveDescriptiveMove(chess, trimmed);
    if (resolved) return { ok: true, san: resolved };
    return {
      ok: false,
      error: 'Ambiguous or illegal descriptive move. Try specifying the square (e.g., "queen takes g4").',
    };
  }

  const normalized = normalizeMoveInput(trimmed);

  const direct = tryChessMove(chess, normalized);
  if (direct) return { ok: true, san: direct };

  const partial = resolvePartialMove(chess, normalized);
  if (partial) {
    const confirmed = tryChessMove(chess, partial);
    if (confirmed) return { ok: true, san: confirmed };
  }

  const fuzzy = fuzzyMatchMove(chess, normalized);
  if (fuzzy) {
    const confirmed = tryChessMove(chess, fuzzy);
    if (confirmed) return { ok: true, san: confirmed };
  }

  return { ok: false, error: `Illegal or unrecognized move: "${normalized}". Try again.` };
}
