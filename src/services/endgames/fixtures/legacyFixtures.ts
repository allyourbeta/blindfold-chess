import type { EndgamePosition } from "../catalog";
import legacyEntriesJson from "./legacyEntries.json";
import legacyManifestJson from "./legacyManifest.json";

/**
 * SPEC_endgames_handpicked.md Part 4.2: the hand-picked catalog has no named,
 * flipped, Black-to-move, or game-result entry, so tests needing one of
 * those kinds read this fixture instead of the shipped catalog. Copied
 * verbatim (checklist rule 3 -- never hand-built) from
 * src/data/endgames.json and scripts/endgames/sources.json at
 * 4df3990039813ffc9e998a9e810178ba84d30a6a, the last commit before the old
 * 274-entry catalog was replaced.
 */
export const LEGACY_ENTRIES = legacyEntriesJson as EndgamePosition[];

export interface LegacyManifestEntry {
  id: string;
  flip: boolean;
  extract: { kind: string; [key: string]: unknown };
}

export const LEGACY_MANIFEST = legacyManifestJson as LegacyManifestEntry[];
