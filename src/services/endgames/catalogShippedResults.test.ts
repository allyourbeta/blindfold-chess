import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeGameResult, swapScore } from "./resultScore";
import { ENDGAMES, sizeOf } from "./catalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sources = JSON.parse(readFileSync(path.resolve(__dirname, "../../../scripts/endgames/sources.json"), "utf8")) as Array<{
  id: string;
  flip: boolean;
  extract: { kind: string; [key: string]: unknown };
}>;

// SPEC_buttons_results.md Part 1: the computed `result` field, read from the
// SHIPPED catalog (src/data/endgames.json) like catalogShipped.test.ts's own
// checks -- split into its own file to keep that file under 300 lines.
describe("the shipped catalog's results", () => {
  it("every entry with 7 pieces or fewer is perfect-or-null, never a game result -- the certain result wins", () => {
    for (const entry of ENDGAMES) {
      if (sizeOf(entry.fen) > 7) continue;
      expect(entry.result === null || entry.result.kind === "perfect", entry.id).toBe(true);
    }
  });

  it("every game-result entry has 8+ pieces and a pgn-ply extract recipe in the manifest", () => {
    const manifestById = new Map(sources.map((e) => [e.id, e]));
    for (const entry of ENDGAMES) {
      if (entry.result?.kind !== "game") continue;
      expect(sizeOf(entry.fen), entry.id).toBeGreaterThanOrEqual(8);
      expect(manifestById.get(entry.id)?.extract.kind, entry.id).toBe("pgn-ply");
    }
  });

  it("a flipped game-result entry's score is the source game's own result, swapped", () => {
    const manifestById = new Map(sources.map((e) => [e.id, e]));
    const flippedGames = ENDGAMES.filter((e) => e.flipped && e.result?.kind === "game");
    expect(flippedGames.length, "no flipped game-result entries to check -- the manifest may have changed").toBeGreaterThan(0);
    for (const entry of flippedGames) {
      const manifestEntry = manifestById.get(entry.id);
      expect(manifestEntry, entry.id).toBeDefined();
      const extract = manifestEntry!.extract as unknown as { pgnUrl: string; game: number };
      const header = cachedGameResult(extract.pgnUrl, extract.game);
      const sourceScore = normalizeGameResult(header);
      expect(sourceScore, `${entry.id}: no usable Result header in the cached source PGN`).not.toBeNull();
      expect(entry.result?.score, entry.id).toBe(swapScore(sourceScore!));
    }
  });
});

/** The same cache-key transform as scripts/endgames/fetchCache.mjs's `cacheKeyFor`. */
function cacheKeyFor(url: string): string {
  return `${url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 180)}.cache`;
}

/** The same multi-game split as scripts/endgames/extract.mjs's `splitPgnGames`. */
function splitPgnGames(text: string): string[] {
  return text
    .split(/\n\s*\n(?=\[Event)/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/**
 * Independently reads the cached PGN (scripts/endgames/.cache/raw/, already
 * populated by `npm run endgames:build`) and returns the `game`-th game's
 * `Result` header -- never the build's own `result` output (checklist rule 3).
 */
function cachedGameResult(pgnUrl: string, game: number): string | null {
  const cachePath = path.resolve(__dirname, "../../../scripts/endgames/.cache/raw", cacheKeyFor(pgnUrl));
  const games = splitPgnGames(readFileSync(cachePath, "utf8"));
  const pgn = games[game];
  if (!pgn) throw new Error(`${pgnUrl}: no cached game at index ${game} (found ${games.length})`);
  const m = /\[Result\s+"([^"]+)"\]/.exec(pgn);
  return m ? m[1] : null;
}
