import { describe, it, expect } from "vitest";
import { materialKey, groupLabel, family, pieceList, search, randomFrom, sizeOf, ENDGAMES, type EndgamePosition } from "./catalog";

describe("materialKey", () => {
  it("puts the stronger side first and names it like KRPvKR", () => {
    expect(materialKey("1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1")).toBe("KRPvKR");
  });

  it("breaks a material tie in favour of White", () => {
    expect(materialKey("4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1")).toBe("KRvKR");
    expect(materialKey("4k3/4r3/8/8/8/8/4R3/4K3 b - - 0 1")).toBe("KRvKR");
  });

  it("repeats a letter for two of the same piece", () => {
    expect(materialKey("4k3/8/8/8/8/8/8/R2K3R w - - 0 1")).toBe("KRRvK");
  });
});

describe("groupLabel", () => {
  it("drops the kings for a rook ending", () => {
    expect(groupLabel("KRPvKR")).toBe("Rook and pawn vs rook");
    expect(groupLabel("KRvKP")).toBe("Rook vs pawn");
  });

  it("keeps 'King' for the pure pawn family", () => {
    expect(groupLabel("KPvK")).toBe("King and pawn vs king");
    expect(groupLabel("KPPvK")).toBe("King and two pawns vs king");
  });

  it("says 'two X' for a doubled piece", () => {
    expect(groupLabel("KRRvK")).toBe("Two rooks vs king");
    expect(groupLabel("KBBvK")).toBe("Two bishops vs king");
  });
});

describe("family", () => {
  it("classifies by the non-pawn, non-king pieces present", () => {
    expect(family("KPvK")).toBe("pawn");
    expect(family("KRPvKR")).toBe("rook");
    expect(family("KBNvK")).toBe("minor");
    expect(family("KQPvKQ")).toBe("queen");
    expect(family("KQvKR")).toBe("mixed");
  });
});

describe("pieceList", () => {
  it("lists K, Q, R, B, N, then pawns, in that order", () => {
    const fen = "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1";
    expect(pieceList(fen, "w")).toBe("Kb8, Rc1, pawn b7.");
    expect(pieceList(fen, "b")).toBe("Kd8, Ra2.");
  });

  it("combines two or more pawns into one phrase", () => {
    const fen = "4k3/8/8/8/8/8/P1P5/4K3 w - - 0 1";
    expect(pieceList(fen, "w")).toBe("Ke1, pawns a2, c2.");
  });
});

describe("search", () => {
  const catalog: EndgamePosition[] = [
    {
      id: "a",
      code: "E001",
      fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
      sourceFen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
      flipped: false,
      name: "Lucena position",
      themes: ["bridge"],
      source: { title: "Test", url: "https://example.com/a" },
      result: null,
    },
    {
      id: "b",
      code: "E002",
      fen: "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1",
      sourceFen: "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1",
      flipped: false,
      name: null,
      themes: ["opposition"],
      source: { title: "Test", url: "https://example.com/b" },
      result: null,
    },
  ];

  it("matches on name, theme, group label, family label, or size bucket label, ANDing words", () => {
    expect(search("lucena", catalog)).toEqual([catalog[0]]);
    expect(search("bridge", catalog)).toEqual([catalog[0]]);
    expect(search("rook", catalog)).toEqual([catalog[0]]); // family label "Rook endings"
    expect(search("opposition", catalog)).toEqual([catalog[1]]);
    expect(search("pawn king", catalog)).toEqual([catalog[1]]); // AND across words
    // bucket label -- both entries are 3-5 pieces; sorted by piece count ascending: b (3) before a (5).
    expect(search("3 to 5", catalog)).toEqual([catalog[1], catalog[0]]);
    expect(search("zzzz", catalog)).toEqual([]);
  });

  it("sorts matches by piece count ascending, then by code", () => {
    const counts = search("rook", ENDGAMES).map((e) => sizeOf(e.fen));
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });
});

describe("randomFrom", () => {
  it("never returns excludeId when more than one entry is available", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
    for (let i = 0; i < 50; i++) {
      expect(randomFrom(list, "a").id).not.toBe("a");
    }
  });

  it("returns the only entry even if it matches excludeId", () => {
    const list = [{ id: "a" }];
    expect(randomFrom(list, "a").id).toBe("a");
  });
});
