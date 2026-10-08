import { parseFenMoveContext } from "@/services/chess/fen";
import {
  ENDGAMES,
  family,
  materialKey,
  groupLabel,
  bucketOf,
  sizeOf,
  SIZE_BUCKETS,
  FAMILY_ORDER,
  FAMILY_INFO,
  type EndgamePosition,
  type Family,
  type SizeBucket,
} from "./catalog";

export function sideToMove(entry: EndgamePosition): "w" | "b" {
  return parseFenMoveContext(entry.fen).sideToMove;
}

export function familyOf(entry: EndgamePosition): Family {
  return family(materialKey(entry.fen));
}

/** The entry's size bucket. Every shipped entry has one; SIZE_BUCKETS[0] is the fallback a stale/malformed fen would never actually need. */
export function bucketOfEntry(entry: EndgamePosition): SizeBucket {
  return bucketOf(entry.fen) ?? SIZE_BUCKETS[0];
}

export function entriesByFamily(fam: Family, catalog: EndgamePosition[] = ENDGAMES): EndgamePosition[] {
  return catalog.filter((e) => familyOf(e) === fam);
}

/** Family -> how many positions it holds. */
export function countsByFamily(catalog: EndgamePosition[] = ENDGAMES): Record<Family, number> {
  const counts: Record<Family, number> = { pawn: 0, rook: 0, minor: 0, queen: 0, mixed: 0 };
  for (const entry of catalog) counts[familyOf(entry)]++;
  return counts;
}

export function entriesByBucket(bucket: SizeBucket, catalog: EndgamePosition[] = ENDGAMES): EndgamePosition[] {
  return catalog.filter((e) => bucketOfEntry(e).label === bucket.label);
}

/** Bucket label -> how many positions it holds, for the home screen's count column. */
export function countsByBucket(catalog: EndgamePosition[] = ENDGAMES): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const bucket of SIZE_BUCKETS) counts[bucket.label] = 0;
  for (const entry of catalog) counts[bucketOfEntry(entry).label]++;
  return counts;
}

export interface MaterialGroup {
  key: string;
  label: string;
  entries: EndgamePosition[];
}

/** Material groups within one family, in catalog file order of first appearance. */
export function groupsForFamily(fam: Family, catalog: EndgamePosition[] = ENDGAMES): MaterialGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, EndgamePosition[]>();
  for (const entry of entriesByFamily(fam, catalog)) {
    const key = materialKey(entry.fen);
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(entry);
  }
  return order.map((key) => ({ key, label: groupLabel(key), entries: byKey.get(key)! }));
}

export interface FamilyGroup {
  family: Family;
  label: string;
  entries: EndgamePosition[];
}

/** Families present within one size bucket, in FAMILY_ORDER; a family with no entries in this bucket is left out. */
export function familiesInBucket(bucket: SizeBucket, catalog: EndgamePosition[] = ENDGAMES): FamilyGroup[] {
  const inBucket = entriesByBucket(bucket, catalog);
  return FAMILY_ORDER.map((fam) => ({
    family: fam,
    label: FAMILY_INFO[fam].label,
    entries: inBucket.filter((e) => familyOf(e) === fam),
  })).filter((group) => group.entries.length > 0);
}

/** The position's own bucket's entries, for "Another of this size" and the game-over "Endgames" button. */
export function bucketEntries(entry: EndgamePosition, catalog: EndgamePosition[] = ENDGAMES): EndgamePosition[] {
  return entriesByBucket(bucketOfEntry(entry), catalog);
}

/** The position's name, or its permanent code when it has none. */
export function displayNameFor(entry: EndgamePosition): string {
  return entry.name ?? entry.code;
}

export interface ResultDisplay {
  label: string;
  score: string;
}

/** The position screen's result line (decision 4), or null when none is known. */
export function resultDisplay(entry: EndgamePosition): ResultDisplay | null {
  if (!entry.result) return null;
  const label = entry.result.kind === "perfect" ? "Perfect play:" : "Game result:";
  const score = entry.result.score === "1/2-1/2" ? "½-½" : entry.result.score;
  return { label, score };
}

/**
 * Favorited codes resolved to catalog entries, smallest first then by
 * code. A code with no matching entry (e.g. a deleted or retired position)
 * is silently dropped -- it's never counted and never shown.
 */
export function favoriteEntries(codes: string[], catalog: EndgamePosition[] = ENDGAMES): EndgamePosition[] {
  const favored = new Set(codes);
  return catalog
    .filter((e) => favored.has(e.code))
    .sort((a, b) => sizeOf(a.fen) - sizeOf(b.fen) || a.code.localeCompare(b.code));
}
