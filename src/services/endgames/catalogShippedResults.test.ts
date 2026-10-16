import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeGameResult, swapScore } from "./resultScore";
import { sizeOf } from "./catalog";
import { LEGACY_ENTRIES, LEGACY_MANIFEST } from "./fixtures/legacyFixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * One game each, extracted verbatim from the real cached PGN the legacy
 * catalog was built from (checklist rule 3 -- never hand-built), and
 * committed here so this test doesn't depend on scripts/endgames/.cache/
 * (gitignored, and no longer populated for these sources now that the
 * hand-picked catalog's manifest doesn't fetch them).
 */
const FIXTURE_PGN_BY_ID: Record<string, string> = {
  "12-to-16-pieces-minor-2": "fixtures/pgn/NewYork1924-game95.pgn",
  "12-to-16-pieces-mixed-2": "fixtures/pgn/Hastings1895-game22.pgn",
};

function fixtureGameResult(entryId: string): string | null {
  const file = FIXTURE_PGN_BY_ID[entryId];
  if (!file) throw new Error(`${entryId}: no committed PGN fixture -- add one to FIXTURE_PGN_BY_ID`);
  const pgn = readFileSync(path.resolve(__dirname, file), "utf8");
  const m = /\[Result\s+"([^"]+)"\]/.exec(pgn);
  return m ? m[1] : null;
}

// SPEC_buttons_results.md Part 1: the computed `result` field. The
// hand-picked catalog (SPEC_endgames_handpicked.md) has no game-result or
// flipped entry, so this reads the legacy fixture (see
// fixtures/legacyFixtures.ts) instead of the shipped catalog -- split into
// its own file to keep that file under 300 lines.
describe("the computed result field, against the legacy fixture", () => {
  it("every entry with 7 pieces or fewer is perfect-or-null, never a game result -- the certain result wins", () => {
    for (const entry of LEGACY_ENTRIES) {
      if (sizeOf(entry.fen) > 7) continue;
      expect(entry.result === null || entry.result.kind === "perfect", entry.id).toBe(true);
    }
  });

  it("every game-result entry has 8+ pieces and a pgn-ply extract recipe in the manifest", () => {
    const manifestById = new Map(LEGACY_MANIFEST.map((e) => [e.id, e]));
    for (const entry of LEGACY_ENTRIES) {
      if (entry.result?.kind !== "game") continue;
      expect(sizeOf(entry.fen), entry.id).toBeGreaterThanOrEqual(8);
      expect(manifestById.get(entry.id)?.extract.kind, entry.id).toBe("pgn-ply");
    }
  });

  it("a flipped game-result entry's score is the source game's own result, swapped", () => {
    const flippedGames = LEGACY_ENTRIES.filter((e) => e.flipped && e.result?.kind === "game");
    expect(flippedGames.length, "fixture needs at least one flipped game-result entry").toBeGreaterThan(0);
    for (const entry of flippedGames) {
      const header = fixtureGameResult(entry.id);
      const sourceScore = normalizeGameResult(header);
      expect(sourceScore, `${entry.id}: no usable Result header in the fixture PGN`).not.toBeNull();
      expect(entry.result?.score, entry.id).toBe(swapScore(sourceScore!));
    }
  });
});
