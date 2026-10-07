import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";
import { mirrorColors } from "./mirror";
import { ENDGAMES } from "./catalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("mirrorColors stays byte-identical to scripts/endgames/mirror.mjs", () => {
  it("has the same function body as the build script's copy", () => {
    const tsSource = readFileSync(path.resolve(__dirname, "mirror.ts"), "utf8");
    const mjsSource = readFileSync(path.resolve(__dirname, "../../../scripts/endgames/mirror.mjs"), "utf8");
    const body = (src: string) => src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1);
    expect(body(tsSource)).toBe(body(mjsSource));
  });
});

describe("mirrorColors, hand-checked pairs", () => {
  // Board:              Board after mirrorColors (e1/e8 swap onto each
  // 8  . . . . k . . .  other, so the placement string is unchanged --
  // 1  . . . . K . . .  only the side to move flips):
  it("flips a bare king vs king position top-to-bottom and swaps colour", () => {
    expect(mirrorColors("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBe("4k3/8/8/8/8/8/8/4K3 b - - 0 1");
  });

  // Board:                    Board after mirrorColors:
  // 8  . . . k . . . .        8  . . . k . . . .
  // 7  . . . . . . . p        7  p . . . . . . .
  // 2  P . . . . . . .        2  . . . . . . . P
  // 1  . . . K . . . .        1  . . . K . . . .
  it("flips pawns on both sides and swaps the side to move", () => {
    expect(mirrorColors("3k4/7p/8/8/8/8/P7/3K4 b - - 0 1")).toBe("3k4/p7/8/8/8/8/7P/3K4 w - - 0 1");
  });

  // Board:                       Board after mirrorColors:
  // 8  . K . k . . . .           8  . . r . . . . .
  // 7  . P . . . . . .           7  R . . . . . . .
  // 2  r . . . . . . .           2  . p . . . . . .
  // 1  . . R . . . . .           1  . k . K . . . .
  it("flips the Lucena position (rook endgame, Black to move case)", () => {
    expect(mirrorColors("1K1k4/1P6/8/8/8/8/r7/2R5 b - - 0 1")).toBe("2r5/R7/8/8/8/8/1p6/1k1K4 w - - 0 1");
  });

  it("is its own inverse for every catalog FEN", () => {
    for (const entry of ENDGAMES) {
      expect(mirrorColors(mirrorColors(entry.fen)), entry.id).toBe(entry.fen);
    }
  });

  it("preserves legal move count for every catalog FEN", () => {
    for (const entry of ENDGAMES) {
      const before = new Chess(entry.fen).moves().length;
      const after = new Chess(mirrorColors(entry.fen)).moves().length;
      expect(after, entry.id).toBe(before);
    }
  });

  it("swaps piece counts by colour exactly, for every catalog FEN", () => {
    for (const entry of ENDGAMES) {
      const board = new Chess(entry.fen).board().flat().filter((sq) => sq !== null);
      const mirrored = new Chess(mirrorColors(entry.fen)).board().flat().filter((sq) => sq !== null);
      const countBy = (list: typeof board, color: "w" | "b", type: string) =>
        list.filter((sq) => sq && sq.color === color && sq.type === type).length;
      for (const type of ["p", "n", "b", "r", "q", "k"]) {
        expect(countBy(mirrored, "w", type), `${entry.id} ${type}`).toBe(countBy(board, "b", type));
        expect(countBy(mirrored, "b", type), `${entry.id} ${type}`).toBe(countBy(board, "w", type));
      }
    }
  });

  it("turns a White pawn on rank 2 into a Black pawn on rank 7", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
    expect(mirrorColors(fen)).toBe("4k3/4p3/8/8/8/8/8/4K3 b - - 0 1");
  });
});
