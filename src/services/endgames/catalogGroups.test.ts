import { describe, it, expect } from "vitest";
import { ENDGAMES, sizeOf, FAMILY_ORDER, SIZE_BUCKETS, type EndgamePosition } from "./catalog";
import {
  groupsForFamily,
  displayNameFor,
  familyOf,
  countsByFamily,
  bucketOfEntry,
  entriesByBucket,
  countsByBucket,
  familiesInBucket,
  bucketEntries,
  favoriteEntries,
  visibleBuckets,
  resultDisplay,
} from "./catalogGroups";
import { LEGACY_ENTRIES } from "./fixtures/legacyFixtures";

describe("countsByFamily / groupsForFamily, against the real shipped catalog", () => {
  it("counts add up to the full catalog, split the same way family() would", () => {
    const counts = countsByFamily();
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(ENDGAMES.length);
  });

  it("every family's groups cover exactly that family's entries, with no entry missing or duplicated", () => {
    for (const fam of FAMILY_ORDER) {
      const groups = groupsForFamily(fam);
      const flat = groups.flatMap((g) => g.entries.map((e) => e.id));
      const expected = ENDGAMES.filter((e) => familyOf(e) === fam).map((e) => e.id);
      expect(new Set(flat)).toEqual(new Set(expected));
      expect(flat.length).toBe(expected.length);
    }
  });
});

describe("countsByBucket / entriesByBucket, against the real shipped catalog", () => {
  it("counts add up to the full catalog, split the same way bucketOfEntry() would", () => {
    const counts = countsByBucket();
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(ENDGAMES.length);
  });

  it("every bucket's entries match entriesByBucket, with no entry missing or duplicated", () => {
    for (const bucket of SIZE_BUCKETS) {
      const got = entriesByBucket(bucket).map((e) => e.id);
      const expected = ENDGAMES.filter((e) => bucketOfEntry(e).label === bucket.label).map((e) => e.id);
      expect(new Set(got)).toEqual(new Set(expected));
      expect(got.length).toBe(expected.length);
    }
  });

  it("bucketEntries(entry) is that entry's own bucket's full entry list", () => {
    const entry = ENDGAMES[0];
    expect(bucketEntries(entry).map((e) => e.id)).toEqual(entriesByBucket(bucketOfEntry(entry)).map((e) => e.id));
  });
});

describe("familiesInBucket, against the real shipped catalog", () => {
  it("lists families in FAMILY_ORDER, skipping any family absent from that bucket", () => {
    for (const bucket of SIZE_BUCKETS) {
      const groups = familiesInBucket(bucket);
      const order = groups.map((g) => g.family);
      const sorted = [...order].sort((a, b) => FAMILY_ORDER.indexOf(a) - FAMILY_ORDER.indexOf(b));
      expect(order).toEqual(sorted);
      for (const group of groups) expect(group.entries.length).toBeGreaterThan(0);
    }
  });

  it("every entry in a bucket appears in exactly one of that bucket's family groups", () => {
    for (const bucket of SIZE_BUCKETS) {
      const groups = familiesInBucket(bucket);
      const flat = groups.flatMap((g) => g.entries.map((e) => e.id));
      const expected = entriesByBucket(bucket).map((e) => e.id);
      expect(new Set(flat)).toEqual(new Set(expected));
      expect(flat.length).toBe(expected.length);
    }
  });
});

describe("visibleBuckets -- the home screen's 'By size' list hides an empty bucket", () => {
  it("against the real shipped catalog, both buckets currently hold a position", () => {
    expect(visibleBuckets().map((b) => b.label)).toEqual(SIZE_BUCKETS.map((b) => b.label));
  });

  it("with a catalog that has no 6-or-more-piece entry, only the 3 to 5 bucket shows", () => {
    const smallOnly = ENDGAMES.filter((e) => sizeOf(e.fen) <= 5);
    expect(smallOnly.length, "fixture needs at least one 3-to-5-piece entry").toBeGreaterThan(0);
    expect(visibleBuckets(smallOnly).map((b) => b.label)).toEqual(["3 to 5 pieces"]);
  });
});

describe("favoriteEntries", () => {
  it("resolves known codes to entries, sorted smallest first, and silently drops unknown codes", () => {
    const a = ENDGAMES[0];
    const b = ENDGAMES[1];
    const result = favoriteEntries([a.code, "E999999", b.code]);
    expect(result.map((e) => e.code).sort()).toEqual([a.code, b.code].sort());
    for (let i = 1; i < result.length; i++) {
      expect(sizeOf(result[i].fen)).toBeGreaterThanOrEqual(sizeOf(result[i - 1].fen));
    }
  });

  it("returns an empty list for no favorites, and ignores an all-unknown list", () => {
    expect(favoriteEntries([])).toEqual([]);
    expect(favoriteEntries(["E999999", "nope"])).toEqual([]);
  });
});

describe("displayNameFor -- name, or the permanent code when there is none", () => {
  it("falls back to the code for an unnamed entry", () => {
    const unnamed = ENDGAMES.find((e) => !e.name);
    expect(unnamed, "the catalog should contain at least one unnamed position").toBeTruthy();
    if (unnamed) expect(displayNameFor(unnamed)).toBe(unnamed.code);
  });

  // The hand-picked catalog has no named entry (SPEC_endgames_handpicked.md
  // decision 6), so this reads the legacy fixture instead -- see
  // fixtures/legacyFixtures.ts.
  it("uses the name, not the code, for a named entry", () => {
    const named = LEGACY_ENTRIES.find((e) => e.name);
    expect(named, "the fixture should contain at least one named position").toBeTruthy();
    if (named) expect(displayNameFor(named)).toBe(named.name);
  });
});

describe("resultDisplay -- the position screen's score chip (SPEC_position_info_line.md)", () => {
  function withResult(result: EndgamePosition["result"]): EndgamePosition {
    return { ...ENDGAMES[0], result };
  }

  it("returns null when the entry has no known result", () => {
    expect(resultDisplay(withResult(null))).toBeNull();
  });

  it("perfect play: en-dash score and a 'best play' spoken label, per side", () => {
    expect(resultDisplay(withResult({ kind: "perfect", score: "1-0" }))).toEqual({
      score: "1–0",
      spoken: "White wins with best play",
    });
    expect(resultDisplay(withResult({ kind: "perfect", score: "0-1" }))).toEqual({
      score: "0–1",
      spoken: "Black wins with best play",
    });
    expect(resultDisplay(withResult({ kind: "perfect", score: "1/2-1/2" }))).toEqual({
      score: "½–½",
      spoken: "Draw with best play",
    });
  });

  it("game result: en-dash score and a 'won/drawn the game' spoken label, per side", () => {
    expect(resultDisplay(withResult({ kind: "game", score: "1-0" }))).toEqual({
      score: "1–0",
      spoken: "White won the game",
    });
    expect(resultDisplay(withResult({ kind: "game", score: "0-1" }))).toEqual({
      score: "0–1",
      spoken: "Black won the game",
    });
    expect(resultDisplay(withResult({ kind: "game", score: "1/2-1/2" }))).toEqual({
      score: "½–½",
      spoken: "The game was drawn",
    });
  });
});
