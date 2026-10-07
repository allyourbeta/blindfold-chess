import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  ENDGAMES,
  materialKey,
  groupLabel,
  family,
  pieceList,
  search,
  randomFrom,
  type EndgamePosition,
} from "./catalog";

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
      fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
      name: "Lucena position",
      themes: ["bridge"],
      goal: "win",
      source: { title: "Test", url: "https://example.com/a" },
    },
    {
      id: "b",
      fen: "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1",
      name: null,
      themes: ["opposition"],
      goal: "win",
      source: { title: "Test", url: "https://example.com/b" },
    },
  ];

  it("matches on name, theme, group label, or family label, ANDing words", () => {
    expect(search("lucena", catalog)).toEqual([catalog[0]]);
    expect(search("bridge", catalog)).toEqual([catalog[0]]);
    expect(search("rook", catalog)).toEqual([catalog[0]]); // family label "Rook endings"
    expect(search("opposition", catalog)).toEqual([catalog[1]]);
    expect(search("pawn king", catalog)).toEqual([catalog[1]]); // AND across words
    expect(search("zzzz", catalog)).toEqual([]);
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

// Checklist rule 3: these read the SHIPPED catalog, never a hand-built fixture.
describe("the shipped catalog (src/data/endgames.json)", () => {
  it("is non-empty", () => {
    expect(ENDGAMES.length).toBeGreaterThan(0);
  });

  it("has a legal, not-already-over FEN for every entry, 7 pieces or fewer", () => {
    for (const entry of ENDGAMES) {
      const chess = new Chess(entry.fen);
      expect(chess.isGameOver(), `${entry.id}: already game over`).toBe(false);
      const pieceCount = chess
        .board()
        .flat()
        .filter((sq) => sq !== null).length;
      expect(pieceCount, `${entry.id}: ${pieceCount} pieces`).toBeLessThanOrEqual(7);
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

  it("totals between 250 and 350 positions", () => {
    expect(ENDGAMES.length).toBeGreaterThanOrEqual(250);
    expect(ENDGAMES.length).toBeLessThanOrEqual(350);
  });

  it("keeps each family within its target range", () => {
    const counts: Record<string, number> = { pawn: 0, rook: 0, minor: 0, queen: 0, mixed: 0 };
    for (const entry of ENDGAMES) counts[family(materialKey(entry.fen))]++;
    expect(counts.pawn).toBeGreaterThanOrEqual(70);
    expect(counts.pawn).toBeLessThanOrEqual(90);
    expect(counts.rook).toBeGreaterThanOrEqual(80);
    expect(counts.rook).toBeLessThanOrEqual(100);
    expect(counts.minor).toBeGreaterThanOrEqual(50);
    expect(counts.minor).toBeLessThanOrEqual(70);
    expect(counts.queen).toBeGreaterThanOrEqual(20);
    expect(counts.queen).toBeLessThanOrEqual(40);
    expect(counts.mixed).toBeGreaterThanOrEqual(30);
    expect(counts.mixed).toBeLessThanOrEqual(50);
  });

  // Grouped by source.title, as the title (not raw host) is what distinguishes
  // e.g. two different Wikipedia articles used as genuinely separate sources.
  it("has at least 5 distinct sources, none supplying more than 40%", () => {
    const bySource = new Map<string, number>();
    for (const entry of ENDGAMES) {
      bySource.set(entry.source.title, (bySource.get(entry.source.title) ?? 0) + 1);
    }
    expect(bySource.size).toBeGreaterThanOrEqual(5);
    for (const [title, count] of bySource) {
      expect(count / ENDGAMES.length, title).toBeLessThanOrEqual(0.4);
    }
  });
});
