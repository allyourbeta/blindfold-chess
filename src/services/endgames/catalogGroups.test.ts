import { describe, it, expect } from "vitest";
import { ENDGAMES, FAMILY_ORDER, SIZE_BUCKETS } from "./catalog";
import {
  groupsForFamily,
  displayNameFor,
  cardLabelFor,
  familyOf,
  countsByFamily,
  bucketOfEntry,
  entriesByBucket,
  countsByBucket,
  familiesInBucket,
  bucketEntries,
} from "./catalogGroups";

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

describe("Position N numbering, using real catalog entries", () => {
  it("numbers unnamed entries 1-based, in catalog file order, within their own bucket and family", () => {
    const unnamed = ENDGAMES.filter((e) => !e.name);
    expect(unnamed.length, "the catalog should contain at least one unnamed position").toBeGreaterThan(0);

    const sample = unnamed[0];
    const bucket = bucketOfEntry(sample);
    const fam = familyOf(sample);
    const siblings = ENDGAMES.filter((e) => bucketOfEntry(e).label === bucket.label && familyOf(e) === fam && !e.name);

    siblings.forEach((entry, index) => {
      expect(displayNameFor(entry)).toBe(`Position ${index + 1}`);
      expect(bucketOfEntry(entry).label).toBe(bucket.label);
      expect(familyOf(entry)).toBe(fam);
    });
  });

  it("never renumbers a named entry", () => {
    const named = ENDGAMES.find((e) => e.name);
    expect(named, "the catalog should contain at least one named position").toBeTruthy();
    if (named) expect(displayNameFor(named)).toBe(named.name);
  });
});

describe("cardLabelFor -- the grid card's shortened label", () => {
  it("shortens 'Position N' to '#N' for an unnamed entry", () => {
    const unnamed = ENDGAMES.find((e) => !e.name);
    expect(unnamed, "the catalog should contain at least one unnamed position").toBeTruthy();
    if (unnamed) {
      const n = displayNameFor(unnamed).replace("Position ", "");
      expect(cardLabelFor(unnamed)).toBe(`#${n}`);
    }
  });

  it("leaves a named entry's name unchanged -- 'Position N' is never a real name", () => {
    const named = ENDGAMES.find((e) => e.name);
    expect(named, "the catalog should contain at least one named position").toBeTruthy();
    if (named) expect(cardLabelFor(named)).toBe(named.name);
  });
});
