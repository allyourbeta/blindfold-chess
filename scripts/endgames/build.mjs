#!/usr/bin/env node
// Builds src/data/endgames.json from scripts/endgames/sources.json by
// actually re-deriving every position from its real source -- see
// SPEC_endgames_catalog.md Part 1b. Safe to re-run: fetches are cached
// under .cache/ (gitignored), so a repeat run is offline.
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractFromRecipe } from "./extract.mjs";
import { mirrorColors } from "./mirror.mjs";
import { isQuiet } from "./quiet.mjs";
import { pieceCount } from "./curationHelpers.mjs";
import { tablebaseCategory } from "./liveness.mjs";
import { categoryToScore, normalizeGameResult, swapScore } from "./resultScore.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = path.resolve(__dirname, "sources.json");
const CODES_PATH = path.resolve(__dirname, "codes.json");
const OUTPUT_PATH = path.resolve(__dirname, "../../src/data/endgames.json");

function normalizedFen(placement, sideToMove) {
  return `${placement} ${sideToMove} - - 0 1`;
}

/**
 * Decisions in SPEC_buttons_results.md: 7 pieces or fewer always gets the
 * tablebase's perfect-play answer (the certain result wins even over a real
 * game); 8 or more gets the source game's result, only when the recipe is
 * `pgn-ply`. Anything else -- an unreachable/uncertain tablebase category, a
 * `*` or missing PGN result, a non-game recipe at 8+ pieces -- ships `null`.
 */
async function computeResult(manifestEntry, fen, gameResultHeader) {
  const count = pieceCount(fen);
  if (count <= 7) {
    let category;
    try {
      category = await tablebaseCategory(fen);
    } catch {
      return null;
    }
    const score = categoryToScore(category, fen.split(" ")[1]);
    return score ? { kind: "perfect", score } : null;
  }
  if (manifestEntry.extract.kind !== "pgn-ply") return null;
  const normalized = normalizeGameResult(gameResultHeader);
  if (!normalized) return null;
  return { kind: "game", score: manifestEntry.flip ? swapScore(normalized) : normalized };
}

async function buildEntry(manifestEntry) {
  const { placement, sideToMove, result: gameResultHeader } = await extractFromRecipe(manifestEntry.extract);
  const sourceFen = normalizedFen(placement, sideToMove);
  const fen = manifestEntry.flip ? mirrorColors(sourceFen) : sourceFen;
  const result = await computeResult(manifestEntry, fen, gameResultHeader);
  return {
    id: manifestEntry.id,
    code: manifestEntry.code,
    fen,
    sourceFen,
    flipped: !!manifestEntry.flip,
    name: manifestEntry.name ?? null,
    themes: manifestEntry.themes ?? [],
    source: manifestEntry.source,
    result,
  };
}

/** Every entry must have a code, no code may repeat, and none may be a retired code. */
function checkCodes(manifest, codes) {
  const problems = [];
  const retired = new Set(codes.retired ?? []);
  const seen = new Map();
  for (const entry of manifest) {
    if (!entry.code) {
      problems.push(`${entry.id}: missing code`);
      continue;
    }
    if (retired.has(entry.code)) problems.push(`${entry.id}: code ${entry.code} is retired`);
    const dupeOf = seen.get(entry.code);
    if (dupeOf) problems.push(`${entry.id}: code ${entry.code} repeats ${dupeOf}`);
    else seen.set(entry.code, entry.id);
  }
  return problems;
}

async function main() {
  const manifest = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
  const codes = JSON.parse(readFileSync(CODES_PATH, "utf8"));

  const codeProblems = checkCodes(manifest, codes);
  if (codeProblems.length > 0) {
    console.error(`${codeProblems.length} code problems:`);
    for (const p of codeProblems) console.error(`  ${p}`);
    process.exit(1);
  }

  const out = [];
  const errors = [];
  for (const entry of manifest) {
    try {
      out.push(await buildEntry(entry));
    } catch (err) {
      errors.push({ id: entry.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (errors.length > 0) {
    console.error(`${errors.length} entries failed to build:`);
    for (const e of errors) console.error(`  ${e.id}: ${e.error}`);
    process.exit(1);
  }

  // SPEC_endgames_quiet.md: a built entry must never let the side to move
  // grab material for free (SEE >= +2 on some capture). Refuse to ship one.
  const notQuiet = out.filter((entry) => !isQuiet(entry.fen));
  if (notQuiet.length > 0) {
    console.error(`${notQuiet.length} built entries are not quiet:`);
    for (const e of notQuiet) console.error(`  ${e.id}: ${e.fen}`);
    process.exit(1);
  }

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${out.length} entries to ${path.relative(process.cwd(), OUTPUT_PATH)}`);

  const perfect = out.filter((e) => e.result?.kind === "perfect").length;
  const game = out.filter((e) => e.result?.kind === "game").length;
  const none = out.length - perfect - game;
  console.log(`Results: ${perfect} perfect, ${game} game, ${none} none.`);
}

main();
