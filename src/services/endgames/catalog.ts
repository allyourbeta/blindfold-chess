import endgamesData from "@/data/endgames.json";
import { fenToBoard, FILES } from "@/services/chess/fen";

export interface EndgamePosition {
  id: string;
  /** Permanent, user-facing identifier (e.g. "E147"). Never changes; a deleted code is never reused. */
  code: string;
  fen: string;
  /** The position before any last-resort colour flip; equal to `fen` when `flipped` is false. */
  sourceFen: string;
  flipped: boolean;
  name: string | null;
  themes: string[];
  source: { title: string; url: string };
  /**
   * Computed at build time (SPEC_buttons_results.md) -- the app never calls
   * the network for this. `"perfect"` comes from the tablebase category of
   * `fen` (7 pieces or fewer wins over any game result); `"game"` comes from
   * a real game's PGN Result header, 8+ pieces only. `null` when neither
   * rule gives a certain score.
   */
  result: { kind: "perfect" | "game"; score: "1-0" | "1/2-1/2" | "0-1" } | null;
}

export type Family = "pawn" | "rook" | "minor" | "queen" | "mixed";

export const ENDGAMES: EndgamePosition[] = endgamesData as EndgamePosition[];

export const FAMILY_ORDER: Family[] = ["pawn", "rook", "minor", "queen", "mixed"];

export const FAMILY_INFO: Record<Family, { label: string; subtitle: string }> = {
  pawn: { label: "Pawn endings", subtitle: "King and pawns only" },
  rook: { label: "Rook endings", subtitle: "Rooks, with or without pawns" },
  minor: { label: "Minor piece endings", subtitle: "Bishops and knights" },
  queen: { label: "Queen endings", subtitle: "Queen against pawns or queen" },
  mixed: { label: "Mixed", subtitle: "Rook against minor piece, and others" },
};

export interface SizeBucket {
  min: number;
  max: number;
  label: string;
  subtitle: string;
}

/** Practice is organized by how many pieces (kings and pawns included) are on the board, not by family. */
export const SIZE_BUCKETS: SizeBucket[] = [
  { min: 3, max: 5, label: "3 to 5 pieces", subtitle: "Kings and a few more" },
  { min: 6, max: 8, label: "6 to 8 pieces", subtitle: "A small ending" },
  { min: 9, max: 11, label: "9 to 11 pieces", subtitle: "A real ending" },
  { min: 12, max: 16, label: "12 to 16 pieces", subtitle: "A heavy ending" },
];

/** Total pieces on the board, kings and pawns included. */
export function sizeOf(fen: string): number {
  return fenToBoard(fen).flat().filter((cell) => cell !== null).length;
}

/** The size bucket a FEN's piece count falls into, or undefined if it falls outside every bucket. */
export function bucketOf(fen: string): SizeBucket | undefined {
  const size = sizeOf(fen);
  return SIZE_BUCKETS.find((b) => size >= b.min && size <= b.max);
}

const PIECE_VALUE: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const PIECE_NAME: Record<string, string> = { q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const PIECE_PLURAL: Record<string, string> = { q: "queens", r: "rooks", b: "bishops", n: "knights", p: "pawns" };
const NUMBER_WORD: Record<number, string> = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" };
/** K,Q,R,B,N,then pawns last -- the order every piece list and label follows. */
const PIECE_RANK = ["q", "r", "b", "n", "p"];

function sideMaterial(fen: string): { white: Record<string, number>; black: Record<string, number> } {
  const board = fenToBoard(fen);
  const white: Record<string, number> = {};
  const black: Record<string, number> = {};
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      const lower = cell.toLowerCase();
      const bucket = cell === cell.toUpperCase() ? white : black;
      bucket[lower] = (bucket[lower] ?? 0) + 1;
    }
  }
  return { white, black };
}

function materialValue(side: Record<string, number>): number {
  return PIECE_RANK.reduce((sum, p) => sum + (PIECE_VALUE[p] ?? 0) * (side[p] ?? 0), 0);
}

function sideKey(side: Record<string, number>): string {
  let key = "K";
  for (const p of PIECE_RANK) key += p.toUpperCase().repeat(side[p] ?? 0);
  return key;
}

/** Canonical material shorthand, e.g. "KRPvKR" -- stronger side first by material, White first on a tie. */
export function materialKey(fen: string): string {
  const { white, black } = sideMaterial(fen);
  const whiteFirst = materialValue(white) >= materialValue(black);
  return `${sideKey(whiteFirst ? white : black)}v${sideKey(whiteFirst ? black : white)}`;
}

function countsFromSideKey(key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ch of key) {
    if (ch === "K") continue;
    const p = ch.toLowerCase();
    counts[p] = (counts[p] ?? 0) + 1;
  }
  return counts;
}

function describePieces(counts: Record<string, number>): string[] {
  const parts: string[] = [];
  for (const p of PIECE_RANK) {
    const n = counts[p] ?? 0;
    if (n === 0) continue;
    parts.push(n === 1 ? PIECE_NAME[p] : `${NUMBER_WORD[n] ?? n} ${PIECE_PLURAL[p]}`);
  }
  return parts;
}

function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Plain-words label for a material key, e.g. "Rook and pawn vs rook". Kings
 * are left out of non-pawn families (nothing to say -- a king is assumed);
 * the pure pawn family keeps "King"/"king" because "pawn vs pawn" alone
 * reads as if the kings aren't there at all.
 */
export function groupLabel(key: string): string {
  const [strongKey, weakKey] = key.split("v");
  const isPawnFamily = family(key) === "pawn";
  const strongParts = describePieces(countsFromSideKey(strongKey));
  const weakParts = describePieces(countsFromSideKey(weakKey));

  if (isPawnFamily) {
    const strong = strongParts.length ? `King and ${joinParts(strongParts)}` : "King";
    const weak = weakParts.length ? `king and ${joinParts(weakParts)}` : "king";
    return `${strong} vs ${weak}`;
  }

  const strong = capitalize(strongParts.length ? joinParts(strongParts) : "king");
  const weak = weakParts.length ? joinParts(weakParts) : "king";
  return `${strong} vs ${weak}`;
}

/** Which practice family a material key belongs to, from its non-pawn, non-king pieces. */
export function family(key: string): Family {
  const letters = new Set<string>();
  for (const ch of key) {
    if (ch === "v" || ch === "K" || ch === "P") continue;
    letters.add(ch.toLowerCase());
  }
  if (letters.size === 0) return "pawn";
  if (letters.size === 1 && letters.has("r")) return "rook";
  if (letters.size === 1 && letters.has("q")) return "queen";
  if ([...letters].every((l) => l === "b" || l === "n")) return "minor";
  return "mixed";
}

/** "Kb8, Rc1, pawn b7." -- the order a blindfolded player would hear it read. */
export function pieceList(fen: string, color: "w" | "b"): string {
  const board = fenToBoard(fen);
  const squaresByLetter: Record<string, string[]> = {};
  const pawnSquares: string[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      const isWhite = cell === cell.toUpperCase();
      if ((color === "w") !== isWhite) continue;
      const lower = cell.toLowerCase();
      const square = `${FILES[c]}${8 - r}`;
      if (lower === "p") pawnSquares.push(square);
      else (squaresByLetter[cell.toUpperCase()] ??= []).push(square);
    }
  }

  const parts: string[] = [];
  for (const letter of ["K", "Q", "R", "B", "N"]) {
    const squares = squaresByLetter[letter];
    if (!squares) continue;
    for (const square of squares.sort()) parts.push(`${letter}${square}`);
  }
  pawnSquares.sort();
  if (pawnSquares.length === 1) parts.push(`pawn ${pawnSquares[0]}`);
  else if (pawnSquares.length > 1) parts.push(`pawns ${pawnSquares.join(", ")}`);

  return `${parts.join(", ")}.`;
}

/**
 * Every word in `query` must appear in the name, a theme, the material
 * group label, the family label, or the size bucket label -- OR'd across
 * those fields, AND'd across words. Results are sorted by piece count
 * ascending, then by permanent code.
 */
export function search(query: string, catalog: EndgamePosition[] = ENDGAMES): EndgamePosition[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return catalog
    .filter((entry) => {
      const key = materialKey(entry.fen);
      const haystacks = [
        entry.name?.toLowerCase() ?? "",
        ...entry.themes.map((t) => t.toLowerCase()),
        groupLabel(key).toLowerCase(),
        FAMILY_INFO[family(key)].label.toLowerCase(),
        bucketOf(entry.fen)?.label.toLowerCase() ?? "",
      ];
      return words.every((w) => haystacks.some((h) => h.includes(w)));
    })
    .sort((a, b) => sizeOf(a.fen) - sizeOf(b.fen) || a.code.localeCompare(b.code));
}

/** Never returns `excludeId` when the list has more than one entry to choose from instead. */
export function randomFrom<T extends { id: string }>(list: T[], excludeId?: string): T {
  const pool = excludeId !== undefined && list.length > 1 ? list.filter((e) => e.id !== excludeId) : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getById(id: string, catalog: EndgamePosition[] = ENDGAMES): EndgamePosition | undefined {
  return catalog.find((e) => e.id === id);
}

export function getByCode(code: string, catalog: EndgamePosition[] = ENDGAMES): EndgamePosition | undefined {
  return catalog.find((e) => e.code === code);
}
