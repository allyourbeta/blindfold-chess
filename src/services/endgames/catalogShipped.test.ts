import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Chess } from "chess.js";
import { mirrorColors } from "./mirror";
import { isQuiet } from "./quiet";
import { isNearCopy } from "../../../scripts/endgames/nearCopy.mjs";
import { ENDGAMES, materialKey, sizeOf } from "./catalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const codes = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../scripts/endgames/codes.json"), "utf8"),
) as { next: number; retired: string[] };

// Checklist rule 3: these read the SHIPPED catalog, never a hand-built
// fixture. Structural invariants only -- SPEC_endgames_handpicked.md Part 4
// dropped the auto-curated-mix checks (total count, per-bucket ranges,
// Black-to-move share, flipped share, source-host spread, family coverage)
// that only made sense for the old 274-entry auto-curated set.
describe("the shipped catalog (src/data/endgames.json)", () => {
  it("is non-empty", () => {
    expect(ENDGAMES.length).toBeGreaterThan(0);
  });

  it("has a legal, not-already-over FEN for every entry, 3 to 16 pieces", () => {
    for (const entry of ENDGAMES) {
      const chess = new Chess(entry.fen);
      expect(chess.isGameOver(), `${entry.id}: already game over`).toBe(false);
      const count = sizeOf(entry.fen);
      expect(count, `${entry.id}: ${count} pieces`).toBeGreaterThanOrEqual(3);
      expect(count, `${entry.id}: ${count} pieces`).toBeLessThanOrEqual(16);
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

  it("has a permanent code matching E### (or more digits) for every entry, all unique", () => {
    for (const entry of ENDGAMES) {
      expect(entry.code, entry.id).toMatch(/^E\d{3,}$/);
    }
    const allCodes = ENDGAMES.map((e) => e.code);
    expect(new Set(allCodes).size).toBe(allCodes.length);
  });

  it("never ships a retired code, and every shipped code is below codes.json's next", () => {
    const retired = new Set(codes.retired);
    for (const entry of ENDGAMES) {
      expect(retired.has(entry.code), entry.id).toBe(false);
      const n = Number(entry.code.slice(1));
      expect(n, entry.id).toBeLessThan(codes.next);
    }
  });

  // SPEC_endgames_handpicked.md decision 5: these hand-picked positions have
  // no source, so there's no https-url rule to enforce -- only that a
  // source, when one exists, is https.
  it("has an https source url whenever an entry has a source", () => {
    for (const entry of ENDGAMES) {
      if (entry.source === null) continue;
      expect(entry.source.url.startsWith("https://"), entry.id).toBe(true);
    }
  });

  it("has fen === flipped ? mirrorColors(sourceFen) : sourceFen for every entry", () => {
    for (const entry of ENDGAMES) {
      const expected = entry.flipped ? mirrorColors(entry.sourceFen) : entry.sourceFen;
      expect(entry.fen, entry.id).toBe(expected);
    }
  });

  it("keeps each material key to at most 8 entries", () => {
    const byKey = new Map<string, number>();
    for (const entry of ENDGAMES) {
      const key = materialKey(entry.fen);
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    }
    for (const [key, count] of byKey) {
      expect(count, key).toBeLessThanOrEqual(8);
    }
  });

  it("never reuses a name", () => {
    const names = ENDGAMES.map((e) => e.name).filter((n): n is string => n !== null);
    expect(new Set(names).size).toBe(names.length);
  });

  // SPEC_endgames_quiet.md: QUIET means the side to move has no capture
  // with a static exchange evaluation of +2 or more. Every shipped entry
  // must be quiet -- no position should let the side to move grab
  // material for free.
  it("is quiet: the side to move has no capture worth 2 pawns or more (SEE)", () => {
    for (const entry of ENDGAMES) {
      expect(isQuiet(entry.fen), entry.id).toBe(true);
    }
  });

  it("has no near-copy pair (identical, file-shifted, mirrored, or colour-mirrored placement)", () => {
    const placements = ENDGAMES.map((e) => e.fen.split(" ")[0]);
    const duplicates: string[] = [];
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        if (isNearCopy(placements[i], placements[j])) {
          duplicates.push(`${ENDGAMES[i].id} ~ ${ENDGAMES[j].id}`);
        }
      }
    }
    expect(duplicates).toEqual([]);
  });
});
