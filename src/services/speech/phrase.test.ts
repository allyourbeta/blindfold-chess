import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { movePhraseClips, gameEndPhraseClips } from "./phrase";

describe("movePhraseClips", () => {
  it("wraps san.ts's phrase parts as clip ids", () => {
    const chess = new Chess();
    const move = chess.moves({ verbose: true }).find((m) => m.san === "e4")!;
    expect(movePhraseClips(move)).toEqual(["pawn", "to", "e", "4"]);
  });

  it("swaps file letters for NATO clips in nato mode", () => {
    const chess = new Chess();
    const move = chess.moves({ verbose: true }).find((m) => m.san === "e4")!;
    expect(movePhraseClips(move, "nato")).toEqual(["pawn", "to", "nato-e", "4"]);
  });

  it("leaves ranks alone in nato mode — digits were never ambiguous", () => {
    const chess = new Chess();
    const move = chess.moves({ verbose: true }).find((m) => m.san === "Nf3")!;
    expect(movePhraseClips(move, "nato")).toEqual(["knight", "to", "nato-f", "3"]);
  });

  it("maps every file letter to a NATO clip", () => {
    const chess = new Chess("8/8/8/8/8/8/PPPPPPPP/K6k w - - 0 1");
    const singleSteps = chess.moves({ verbose: true }).filter((m) => m.piece === "p");
    const files = new Set(singleSteps.flatMap((m) => movePhraseClips(m, "nato")).filter((c) => c.startsWith("nato-")));
    expect(files.size).toBe(8);
  });
});

describe("gameEndPhraseClips", () => {
  it("plays the stalemate clip for a stalemate", () => {
    expect(gameEndPhraseClips("stalemate")).toEqual(["stalemate"]);
  });

  it("plays the draw clip for the other draw reasons", () => {
    expect(gameEndPhraseClips("threefold-repetition")).toEqual(["draw"]);
    expect(gameEndPhraseClips("insufficient-material")).toEqual(["draw"]);
    expect(gameEndPhraseClips("fifty-move-rule")).toEqual(["draw"]);
  });

  it("plays nothing extra for checkmate or resignation", () => {
    expect(gameEndPhraseClips("checkmate")).toEqual([]);
    expect(gameEndPhraseClips("resignation")).toEqual([]);
  });
});
