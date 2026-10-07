import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { see, isQuiet } from "./quiet";
import * as quietMjs from "../../../scripts/endgames/quiet.mjs";
import { ENDGAMES } from "./catalog";

// The three bad examples from SPEC_endgames_quiet.md's audit -- real
// shipped positions where the side to move grabs material for free.
const NOT_QUIET_EXAMPLES = [
  "1r5Q/2kb1p2/4P3/3pP3/pp1N4/8/PPPR4/1K6 b - - 0 1",
  "r2r2k1/1b3ppp/4p3/8/1R2P3/3Q4/5PPP/1R4K1 b - - 0 1",
  "2q2bk1/p4r1p/1p4pB/8/8/1Q5P/3r1PP1/3R3K w - - 0 1",
];

describe("isQuiet", () => {
  it("rejects the three audited free-capture examples", () => {
    for (const fen of NOT_QUIET_EXAMPLES) {
      expect(isQuiet(fen), fen).toBe(false);
    }
  });

  it("accepts the starting position (no captures at all)", () => {
    expect(isQuiet("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1")).toBe(true);
  });

  it("accepts a queen capturing a pawn defended by another pawn", () => {
    // White queen d4 can take e5, but the f6 pawn recaptures for free: SEE is deeply negative.
    const fen = "4k3/8/5p2/4p3/3Q4/8/8/4K3 w - - 0 1";
    expect(see(fen, { from: "d4", to: "e5" })).toBeLessThan(2);
    expect(isQuiet(fen)).toBe(true);
  });
});

describe("see", () => {
  it("values an undefended capture at the full value of the captured piece", () => {
    expect(see("1r5Q/2kb1p2/4P3/3pP3/pp1N4/8/PPPR4/1K6 b - - 0 1", { from: "b8", to: "h8" })).toBe(9);
  });

  it("returns 0 for a non-capturing move", () => {
    expect(see("4k3/8/8/8/8/8/8/4K3 w - - 0 1", { from: "e1", to: "e2" })).toBe(0);
  });
});

// quiet.mjs is a separate, plain-JS copy used by the offline build/pool
// scripts (TypeScript's strict mode forces type annotations on quiet.ts's
// internal helpers that plain JS can't carry, so unlike mirror.ts/mirror.mjs
// this pair can't be byte-identical -- see the comment atop quiet.mjs).
// This proves the two never drift apart on a result instead: every capture
// in the shipped catalog, plus the audited examples, must score identically
// under both copies.
describe("scripts/endgames/quiet.mjs stays in step with quiet.ts", () => {
  it("agrees with quiet.ts on isQuiet for every shipped catalog entry", () => {
    for (const entry of ENDGAMES) {
      expect(quietMjs.isQuiet(entry.fen), entry.id).toBe(isQuiet(entry.fen));
    }
  });

  it("agrees with quiet.ts on see() for every capture in the shipped catalog", () => {
    for (const entry of ENDGAMES) {
      const chess = new Chess(entry.fen);
      const captures = chess.moves({ verbose: true }).filter((m) => m.captured);
      for (const m of captures) {
        const move = { from: m.from, to: m.to, promotion: m.promotion };
        expect(quietMjs.see(entry.fen, move), `${entry.id} ${m.san}`).toBe(see(entry.fen, move));
      }
    }
  });

  it("agrees with quiet.ts on the three audited free-capture examples", () => {
    for (const fen of NOT_QUIET_EXAMPLES) {
      expect(quietMjs.isQuiet(fen), fen).toBe(isQuiet(fen));
    }
  });
});
