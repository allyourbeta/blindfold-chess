import { parseFenMoveContext } from "@/services/chess/fen";
import { ENDGAMES, family, materialKey, groupLabel, type EndgamePosition, type Family } from "./catalog";

export function sideToMove(entry: EndgamePosition): "w" | "b" {
  return parseFenMoveContext(entry.fen).sideToMove;
}

export function familyOf(entry: EndgamePosition): Family {
  return family(materialKey(entry.fen));
}

export function entriesByFamily(fam: Family, catalog: EndgamePosition[] = ENDGAMES): EndgamePosition[] {
  return catalog.filter((e) => familyOf(e) === fam);
}

/** Family -> how many positions it holds, for the home screen's count chips. */
export function countsByFamily(catalog: EndgamePosition[] = ENDGAMES): Record<Family, number> {
  const counts: Record<Family, number> = { pawn: 0, rook: 0, minor: 0, queen: 0, mixed: 0 };
  for (const entry of catalog) counts[familyOf(entry)]++;
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

/** The position's own group, for the game-over "Endgames" button and "Another from this group". */
export function groupEntries(entry: EndgamePosition, catalog: EndgamePosition[] = ENDGAMES): EndgamePosition[] {
  const key = materialKey(entry.fen);
  return catalog.filter((e) => materialKey(e.fen) === key);
}

export function displayNameFor(entry: EndgamePosition, catalog: EndgamePosition[] = ENDGAMES): string {
  if (entry.name) return entry.name;
  const siblings = groupEntries(entry, catalog);
  const index = siblings.filter((e) => !e.name).findIndex((e) => e.id === entry.id);
  return `Position ${index + 1}`;
}
