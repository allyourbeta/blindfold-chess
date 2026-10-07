import { describe, it, expect } from "vitest";
import { ENDGAMES, materialKey, FAMILY_ORDER } from "./catalog";
import { groupsForFamily, displayNameFor, familyOf, countsByFamily, groupEntries } from "./catalogGroups";

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

describe("Position N numbering, using real catalog entries", () => {
  it("numbers unnamed entries 1-based, in catalog file order, within their own material group", () => {
    const unnamed = ENDGAMES.filter((e) => !e.name);
    expect(unnamed.length, "the catalog should contain at least one unnamed position").toBeGreaterThan(0);

    const key = materialKey(unnamed[0].fen);
    const siblings = groupEntries(unnamed[0]);
    const unnamedSiblings = siblings.filter((e) => !e.name);

    unnamedSiblings.forEach((entry, index) => {
      expect(displayNameFor(entry)).toBe(`Position ${index + 1}`);
      expect(materialKey(entry.fen)).toBe(key);
    });
  });

  it("never renumbers a named entry", () => {
    const named = ENDGAMES.find((e) => e.name);
    expect(named, "the catalog should contain at least one named position").toBeTruthy();
    if (named) expect(displayNameFor(named)).toBe(named.name);
  });
});
