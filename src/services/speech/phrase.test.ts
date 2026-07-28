import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";
import { movePhraseClips, gameEndPhraseClips, speechTextForClips, CLIP_IDS } from "./phrase";

describe("movePhraseClips", () => {
  it("wraps san.ts's phrase parts as clip ids", () => {
    const chess = new Chess();
    const move = chess.moves({ verbose: true }).find((m) => m.san === "e4")!;
    expect(movePhraseClips(move)).toEqual(["pawn", "e", "4"]);
  });

  it("swaps file letters for NATO clips in nato mode", () => {
    const chess = new Chess();
    const move = chess.moves({ verbose: true }).find((m) => m.san === "e4")!;
    expect(movePhraseClips(move, "nato")).toEqual(["pawn", "nato-e", "4"]);
  });

  it("leaves ranks alone in nato mode — digits were never ambiguous", () => {
    const chess = new Chess();
    const move = chess.moves({ verbose: true }).find((m) => m.san === "Nf3")!;
    expect(movePhraseClips(move, "nato")).toEqual(["knight", "nato-f", "3"]);
  });

  it("maps every file letter to a NATO clip", () => {
    const chess = new Chess("8/8/8/8/8/8/PPPPPPPP/K6k w - - 0 1");
    const singleSteps = chess.moves({ verbose: true }).filter((m) => m.piece === "p");
    const files = new Set(singleSteps.flatMap((m) => movePhraseClips(m, "nato")).filter((c) => c.startsWith("nato-")));
    expect(files.size).toBe(8);
  });
});

describe("speechTextForClips", () => {
  it("turns clip ids into natural text for native iPhone speech", () => {
    expect(speechTextForClips(["knight", "nato-f", "3", "check"])).toBe(
      "knight foxtrot 3 check",
    );
    expect(speechTextForClips(["castles-kingside"])).toBe("castles kingside");
    expect(speechTextForClips(["not-legal"])).toBe("is not legal");
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

describe("CLIP_IDS", () => {
  const audioDir = fileURLToPath(new URL("../../../public/audio", import.meta.url));
  const generatedIds = new Set(
    readdirSync(audioDir)
      .filter((f) => f.endsWith(".wav"))
      .map((f) => f.replace(/\.wav$/, "")),
  );

  it("has no duplicates", () => {
    expect(new Set(CLIP_IDS).size).toBe(CLIP_IDS.length);
  });

  it("matches exactly the clips generated in public/audio", () => {
    expect(new Set(CLIP_IDS)).toEqual(generatedIds);
  });

  it("covers every clip movePhraseClips can produce, in both file-naming modes", () => {
    const chess = new Chess();
    // A broad mix of piece types, captures, and promotions from a few real games.
    const sans = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"];
    for (const san of sans) chess.move(san);
    const moves = chess.history({ verbose: true });
    // Also cover promotion and en passant explicitly, which the opening above can't reach.
    const promoChess = new Chess("8/P7/8/8/8/8/7k/K7 w - - 0 1");
    const promoMove = promoChess.moves({ verbose: true }).find((m) => m.promotion === "q")!;
    const allMoves = [...moves, promoMove];

    for (const move of allMoves) {
      for (const clip of movePhraseClips(move, "letters")) expect(CLIP_IDS).toContain(clip);
      for (const clip of movePhraseClips(move, "nato")) expect(CLIP_IDS).toContain(clip);
    }
  });

  it("covers every clip gameEndPhraseClips can produce", () => {
    for (const reason of ["checkmate", "stalemate", "threefold-repetition", "insufficient-material", "fifty-move-rule", "resignation"] as const) {
      for (const clip of gameEndPhraseClips(reason)) expect(CLIP_IDS).toContain(clip);
    }
  });
});
