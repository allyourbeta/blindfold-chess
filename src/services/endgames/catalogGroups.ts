import { parseFenMoveContext } from "@/services/chess/fen";
import {
  ENDGAMES,
  family,
  materialKey,
  groupLabel,
  bucketOf,
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

export function displayNameFor(entry: EndgamePosition, catalog: EndgamePosition[] = ENDGAMES): string {
  if (entry.name) return entry.name;
  const bucket = bucketOfEntry(entry);
  const fam = familyOf(entry);
  const siblings = catalog.filter((e) => bucketOfEntry(e).label === bucket.label && familyOf(e) === fam && !e.name);
  const index = siblings.findIndex((e) => e.id === entry.id);
  return `Position ${index + 1}`;
}
