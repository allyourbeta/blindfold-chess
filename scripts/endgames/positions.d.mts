export interface ManifestEntry {
  id: string;
  code: string;
  name: string | null;
  themes: string[];
  extract: { kind: string; placement: string; sideToMove: "w" | "b" };
  flip: boolean;
}

export interface Codes {
  next: number;
  retired: string[];
}

export declare function addEntry(
  manifest: ManifestEntry[],
  codes: Codes,
  position: { placement: string; sideToMove: "w" | "b" },
): { manifest: ManifestEntry[]; codes: Codes; code: string };

export declare function deleteEntry(
  manifest: ManifestEntry[],
  codes: Codes,
  code: string,
): { manifest: ManifestEntry[]; codes: Codes };

export interface PositionRow {
  code: string;
  sideToMove: "w" | "b";
  pieces: number;
}

export declare function listEntries(manifest: ManifestEntry[]): PositionRow[];

export declare function rotate180(placement: string): string;
