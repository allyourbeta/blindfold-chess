import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { mirrorColors } from "./mirror";
import { ENDGAMES, materialKey, family, sizeOf, bucketOf, SIZE_BUCKETS } from "./catalog";

// Checklist rule 3: these read the SHIPPED catalog, never a hand-built
// fixture. See SPEC_endgames_catalog.md Part 1e for every numbered rule.
describe("the shipped catalog (src/data/endgames.json)", () => {
  it("is non-empty", () => {
    expect(ENDGAMES.length).toBeGreaterThan(0);
  });

  it("has a legal, not-already-over FEN for every entry, 3 to 16 pieces", () => {
    for (const entry of ENDGAMES) {
      const chess = new Chess(entry.fen);
      expect(chess.isGameOver(), `${entry.id}: already game over`).toBe(false);
      const count = sizeOf(entry.fen);
      expect(count, `${entry.id}: ${count} pieces`).toBeGreaterThanOrEqual(3);
      expect(count, `${entry.id}: ${count} pieces`).toBeLessThanOrEqual(16);
    }
  });

  it("has no castling rights and no en-passant square for any entry", () => {
    for (const entry of ENDGAMES) {
      const [, , castling, ep] = entry.fen.split(" ");
      expect(castling, entry.id).toBe("-");
      expect(ep, entry.id).toBe("-");
    }
  });

  it("has a unique id for every entry", () => {
    const ids = ENDGAMES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has an https source url for every entry", () => {
    for (const entry of ENDGAMES) {
      expect(entry.source.url.startsWith("https://"), entry.id).toBe(true);
    }
  });

  it("totals between 260 and 320 positions", () => {
    expect(ENDGAMES.length).toBeGreaterThanOrEqual(260);
    expect(ENDGAMES.length).toBeLessThanOrEqual(320);
  });

  it("keeps each size bucket within its target range", () => {
    const ranges: Record<string, [number, number]> = {
      "3 to 5 pieces": [60, 80],
      "6 to 8 pieces": [70, 90],
      "9 to 11 pieces": [60, 80],
      "12 to 16 pieces": [50, 70],
    };
    const counts: Record<string, number> = {};
    for (const entry of ENDGAMES) {
      const label = bucketOf(entry.fen)?.label;
      expect(label, `${entry.id}: not in any size bucket`).toBeDefined();
      counts[label!] = (counts[label!] ?? 0) + 1;
    }
    for (const bucket of SIZE_BUCKETS) {
      const [min, max] = ranges[bucket.label];
      expect(counts[bucket.label] ?? 0, bucket.label).toBeGreaterThanOrEqual(min);
      expect(counts[bucket.label] ?? 0, bucket.label).toBeLessThanOrEqual(max);
    }
  });

  it("keeps Black-to-move between 40% and 60% in every size bucket", () => {
    for (const bucket of SIZE_BUCKETS) {
      const inBucket = ENDGAMES.filter((e) => bucketOf(e.fen)?.label === bucket.label);
      const black = inBucket.filter((e) => e.fen.split(" ")[1] === "b").length;
      const share = black / inBucket.length;
      expect(share, bucket.label).toBeGreaterThanOrEqual(0.4);
      expect(share, bucket.label).toBeLessThanOrEqual(0.6);
    }
  });

  it("keeps flipped entries to at most 25% overall and 35% per bucket", () => {
    const flippedTotal = ENDGAMES.filter((e) => e.flipped).length;
    expect(flippedTotal / ENDGAMES.length).toBeLessThanOrEqual(0.25);
    for (const bucket of SIZE_BUCKETS) {
      const inBucket = ENDGAMES.filter((e) => bucketOf(e.fen)?.label === bucket.label);
      const flipped = inBucket.filter((e) => e.flipped).length;
      expect(flipped / inBucket.length, bucket.label).toBeLessThanOrEqual(0.35);
    }
  });

  it("has fen === flipped ? mirrorColors(sourceFen) : sourceFen for every entry", () => {
    for (const entry of ENDGAMES) {
      const expected = entry.flipped ? mirrorColors(entry.sourceFen) : entry.sourceFen;
      expect(entry.fen, entry.id).toBe(expected);
    }
  });

  // Counted by host, not by source.title -- two articles on the same site
  // still share a host, and the rule exists so no single SITE can quietly
  // supply almost everything, the way en.wikipedia.org did before this round.
  it("has at least 5 distinct source hosts, none supplying more than 40%", () => {
    const byHost = new Map<string, number>();
    for (const entry of ENDGAMES) {
      const host = new URL(entry.source.url).host;
      byHost.set(host, (byHost.get(host) ?? 0) + 1);
    }
    expect(byHost.size).toBeGreaterThanOrEqual(5);
    for (const [host, count] of byHost) {
      expect(count / ENDGAMES.length, host).toBeLessThanOrEqual(0.4);
    }
  });

  it("keeps each material key to at most 8 entries", () => {
    const byKey = new Map<string, number>();
    for (const entry of ENDGAMES) {
      const key = materialKey(entry.fen);
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    }
    for (const [key, count] of byKey) {
      expect(count, key).toBeLessThanOrEqual(8);
    }
  });

  it("never reuses a name", () => {
    const names = ENDGAMES.map((e) => e.name).filter((n): n is string => n !== null);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has every family in at least three of the four size buckets", () => {
    const coverage: Record<string, Set<string>> = {
      pawn: new Set(),
      rook: new Set(),
      minor: new Set(),
      queen: new Set(),
      mixed: new Set(),
    };
    for (const entry of ENDGAMES) {
      const fam = family(materialKey(entry.fen));
      const label = bucketOf(entry.fen)?.label;
      if (label) coverage[fam].add(label);
    }
    for (const [fam, buckets] of Object.entries(coverage)) {
      expect(buckets.size, fam).toBeGreaterThanOrEqual(3);
    }
  });

  it("has no near-copy pair (identical, file-shifted, mirrored, or colour-mirrored placement)", () => {
    const placements = ENDGAMES.map((e) => e.fen.split(" ")[0]);
    const duplicates: string[] = [];
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        if (isNearCopy(placements[i], placements[j])) {
          duplicates.push(`${ENDGAMES[i].id} ~ ${ENDGAMES[j].id}`);
        }
      }
    }
    expect(duplicates).toEqual([]);
  });
});

function expandRank(rank: string): (string | null)[] {
  const squares: (string | null)[] = [];
  for (const ch of rank) {
    if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) squares.push(null);
    else squares.push(ch);
  }
  return squares;
}

function collapseRank(squares: (string | null)[]): string {
  let out = "";
  let empties = 0;
  for (const sq of squares) {
    if (sq === null) empties++;
    else {
      if (empties) {
        out += empties;
        empties = 0;
      }
      out += sq;
    }
  }
  if (empties) out += empties;
  return out || "8";
}

function shiftFiles(placement: string, by: number): string {
  return placement
    .split("/")
    .map((rank) => {
      const squares = expandRank(rank);
      const shifted = new Array<string | null>(8).fill(null);
      for (let i = 0; i < 8; i++) {
        const j = i + by;
        if (j >= 0 && j < 8) shifted[j] = squares[i];
      }
      return collapseRank(shifted);
    })
    .join("/");
}

function mirrorFilesOf(placement: string): string {
  return placement
    .split("/")
    .map((rank) => collapseRank(expandRank(rank).reverse()))
    .join("/");
}

function isNearCopy(a: string, b: string): boolean {
  if (a === b) return true;
  for (let shift = -7; shift <= 7; shift++) {
    if (shift !== 0 && shiftFiles(a, shift) === b) return true;
  }
  if (mirrorFilesOf(a) === b) return true;
  if (mirrorColors(`${a} w - - 0 1`).split(" ")[0] === b) return true;
  return false;
}
