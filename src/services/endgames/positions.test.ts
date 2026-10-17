import { describe, it, expect } from "vitest";
import {
  addEntry,
  deleteEntry,
  listEntries,
  rotate180,
  type Codes,
  type ManifestEntry,
} from "../../../scripts/endgames/positions.mjs";

// Two real entries, copied verbatim from scripts/endgames/sources.json at
// the SHA this spec started from (a52cd19). Fixed here, never read from the
// live manifest -- this suite must never touch the shipped catalog.
function fixtureManifest(): ManifestEntry[] {
  return [
    {
      id: "e275",
      code: "E275",
      name: null,
      themes: [],
      extract: { kind: "fen", placement: "2K1N3/3P1n2/8/4k3/8/8/8/8", sideToMove: "w" },
      flip: false,
    },
    {
      id: "e276",
      code: "E276",
      name: null,
      themes: [],
      extract: { kind: "fen", placement: "3k4/8/8/8/8/8/8/4KBN1", sideToMove: "w" },
      flip: false,
    },
  ];
}

// An arbitrary, self-contained range -- deliberately not the live catalog's
// actual `next`/`retired`, so a bug here can never touch real codes.
function fixtureCodes(): Codes {
  return { next: 400, retired: ["E001", "E002"] };
}

const FRESH_QUIET_FEN = { placement: "4k3/8/8/8/8/8/8/4KQ2", sideToMove: "w" as const };
const ILLEGAL_NO_KING = { placement: "8/8/8/8/8/8/8/8", sideToMove: "w" as const };
const ALREADY_OVER = { placement: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR", sideToMove: "w" as const };
const NOT_QUIET = { placement: "1r5Q/2kb1p2/4P3/3pP3/pp1N4/8/PPPR4/1K6", sideToMove: "b" as const };

describe("addEntry", () => {
  it("assigns the next code, bumps codes.next, and appends the entry unchanged otherwise", () => {
    const manifest = fixtureManifest();
    const codes = fixtureCodes();
    const result = addEntry(manifest, codes, FRESH_QUIET_FEN);

    expect(result.code).toBe("E400");
    expect(result.codes.next).toBe(401);
    expect(result.manifest).toHaveLength(3);
    expect(result.manifest.at(-1)).toEqual({
      id: "e400",
      code: "E400",
      name: null,
      themes: [],
      extract: { kind: "fen", placement: FRESH_QUIET_FEN.placement, sideToMove: "w" },
      flip: false,
    });
    // Inputs are never mutated.
    expect(manifest).toHaveLength(2);
    expect(codes.next).toBe(400);
  });

  it("rejects an illegal position", () => {
    expect(() => addEntry(fixtureManifest(), fixtureCodes(), ILLEGAL_NO_KING)).toThrow(/illegal/);
  });

  it("rejects a position that is already over", () => {
    expect(() => addEntry(fixtureManifest(), fixtureCodes(), ALREADY_OVER)).toThrow(/already over/);
  });

  it("rejects a position that is not quiet", () => {
    expect(() => addEntry(fixtureManifest(), fixtureCodes(), NOT_QUIET)).toThrow(/not quiet/);
  });

  it("rejects a near-copy of an existing entry", () => {
    // Identical to e276's placement.
    const nearCopy = { placement: "3k4/8/8/8/8/8/8/4KBN1", sideToMove: "w" as const };
    expect(() => addEntry(fixtureManifest(), fixtureCodes(), nearCopy)).toThrow(/near-copy.*E276/);
  });
});

describe("deleteEntry", () => {
  it("removes the entry and retires its code", () => {
    const manifest = fixtureManifest();
    const codes = fixtureCodes();
    const result = deleteEntry(manifest, codes, "E275");

    expect(result.manifest.map((e) => e.code)).toEqual(["E276"]);
    expect(result.codes.retired).toEqual(["E001", "E002", "E275"]);
    // Inputs are never mutated.
    expect(manifest).toHaveLength(2);
    expect(codes.retired).toEqual(["E001", "E002"]);
  });

  it("throws on an unknown code", () => {
    expect(() => deleteEntry(fixtureManifest(), fixtureCodes(), "E999")).toThrow(/E999/);
  });

  it("never reassigns a deleted code to a later add", () => {
    let manifest = fixtureManifest();
    let codes = fixtureCodes();

    const first = addEntry(manifest, codes, FRESH_QUIET_FEN);
    manifest = first.manifest;
    codes = first.codes;

    const afterDelete = deleteEntry(manifest, codes, "E275");
    manifest = afterDelete.manifest;
    codes = afterDelete.codes;

    const second = addEntry(manifest, codes, { placement: "4k3/8/8/8/8/8/8/4KR2", sideToMove: "w" });

    expect(second.code).not.toBe("E275");
    expect(second.code).not.toBe(first.code);
    expect(codes.retired).toContain("E275");
    expect(second.manifest.some((e) => e.code === "E275")).toBe(false);
  });
});

describe("rotate180", () => {
  it("round-trips", () => {
    const placement = "2K1N3/3P1n2/8/4k3/8/8/8/8";
    expect(rotate180(rotate180(placement))).toBe(placement);
  });

  it("reverses rank order and file order within each rank, for a known example", () => {
    // Rank 8 becomes rank 1 reversed, and vice versa; the middle ranks swap
    // and reverse too. Pieces keep their own letter/colour -- only position moves.
    expect(rotate180("4k3/8/8/8/8/8/8/4KBN1")).toBe("1NBK4/8/8/8/8/8/8/3k4");
  });
});

describe("listEntries", () => {
  it("returns code, side to move, and piece count for every entry", () => {
    expect(listEntries(fixtureManifest())).toEqual([
      { code: "E275", sideToMove: "w", pieces: 5 },
      { code: "E276", sideToMove: "w", pieces: 4 },
    ]);
  });
});
