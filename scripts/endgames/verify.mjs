#!/usr/bin/env node
// Independently re-derives every catalog entry from its real source and
// checks it, per SPEC_endgames_catalog.md Part 1d. This never trusts a
// value stored in src/data/endgames.json -- extraction is re-run from
// (cached) real source text, exactly like build.mjs does.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Chess } from "chess.js";
import { extractFromRecipe } from "./extract.mjs";
import { mirrorColors } from "./mirror.mjs";
import { pieceCount, bucketFor } from "./curationHelpers.mjs";
import { checkNotLost, tablebaseCategory, stockfishEval } from "./liveness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = path.resolve(__dirname, "sources.json");
const DATA_PATH = path.resolve(__dirname, "../../src/data/endgames.json");
const REPORT_PATH = path.resolve(__dirname, "verify-report.md");

function normalizedFen(placement, sideToMove) {
  return `${placement} ${sideToMove} - - 0 1`;
}

async function verifyOne(manifestEntry, shipped) {
  const problems = [];

  // 1. Re-extract sourceFen from the cached source; must equal the stored sourceFen exactly.
  const { placement, sideToMove } = await extractFromRecipe(manifestEntry.extract);
  const reExtractedSourceFen = normalizedFen(placement, sideToMove);
  if (reExtractedSourceFen !== shipped.sourceFen) {
    problems.push(`sourceFen mismatch: re-extracted "${reExtractedSourceFen}" vs shipped "${shipped.sourceFen}"`);
  }

  // 2. fen === (flipped ? mirrorColors(sourceFen) : sourceFen).
  const expectedFen = manifestEntry.flip ? mirrorColors(shipped.sourceFen) : shipped.sourceFen;
  if (expectedFen !== shipped.fen) {
    problems.push(`fen mismatch: expected "${expectedFen}" vs shipped "${shipped.fen}"`);
  }

  // 3. Legal, not already over, side not to move not in check.
  let chess;
  try {
    chess = new Chess(shipped.fen);
    if (chess.isGameOver()) problems.push("position is already game over");
  } catch (err) {
    problems.push(`illegal FEN: ${err instanceof Error ? err.message : String(err)}`);
    return { problems, size: null, sideToMove: null, livenessDetail: null };
  }

  const size = pieceCount(shipped.fen);
  const bucket = bucketFor(size);
  if (!bucket) problems.push(`piece count ${size} is outside every size bucket`);

  // 4. Not lost for the side to move.
  const liveness = await checkNotLost(shipped.fen, size);
  if (!liveness.ok) problems.push(`side to move is lost or unreachable: ${liveness.detail}`);

  // 5. For a flipped entry: eval within 0.3 pawns (or tablebase categories match).
  let flipCheckDetail = null;
  if (manifestEntry.flip) {
    if (size <= 7) {
      const [sourceCategory, flippedCategory] = await Promise.all([
        tablebaseCategory(shipped.sourceFen),
        tablebaseCategory(shipped.fen),
      ]);
      flipCheckDetail = `source=${sourceCategory} flipped=${flippedCategory}`;
      if (sourceCategory !== flippedCategory) {
        problems.push(`flip changed the tablebase category: ${flipCheckDetail}`);
      }
    } else {
      const [sourceEval, flippedEval] = await Promise.all([stockfishEval(shipped.sourceFen), stockfishEval(shipped.fen)]);
      flipCheckDetail = `source=${sourceEval}cp flipped=${flippedEval}cp`;
      if (sourceEval === null || flippedEval === null || Math.abs(sourceEval - flippedEval) > 30) {
        problems.push(`flip changed the evaluation by more than 0.3 pawns: ${flipCheckDetail}`);
      }
    }
  }

  return { problems, size, sideToMove: chess.turn(), livenessDetail: liveness.detail, flipCheckDetail };
}

async function main() {
  const manifest = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
  const shippedCatalog = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const shippedById = new Map(shippedCatalog.map((e) => [e.id, e]));

  const reportLines = ["# Endgames verify report", "", "| id | size | side | eval/category | flipped | status |", "|---|---|---|---|---|---|"];
  let okCount = 0;
  let failCount = 0;
  const failures = [];

  for (const entry of manifest) {
    const shipped = shippedById.get(entry.id);
    if (!shipped) {
      failCount++;
      failures.push(`${entry.id}: not present in src/data/endgames.json`);
      reportLines.push(`| ${entry.id} | - | - | - | - | MISSING |`);
      continue;
    }
    let result;
    try {
      result = await verifyOne(entry, shipped);
    } catch (err) {
      result = { problems: [err instanceof Error ? err.message : String(err)], size: null, sideToMove: null, livenessDetail: null };
    }
    const status = result.problems.length === 0 ? "OK" : "FAIL";
    if (status === "OK") okCount++;
    else {
      failCount++;
      failures.push(`${entry.id}: ${result.problems.join("; ")}`);
    }
    reportLines.push(
      `| ${entry.id} | ${result.size ?? "-"} | ${result.sideToMove ?? "-"} | ${result.livenessDetail ?? "-"} | ${entry.flip} | ${status} |`,
    );
  }

  reportLines.push("", `**${okCount} ok, ${failCount} failed, ${manifest.length} total.**`);
  writeFileSync(REPORT_PATH, `${reportLines.join("\n")}\n`);

  console.log(`\n${okCount} ok, ${failCount} failed (of ${manifest.length} total)`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  console.log(`Report written to ${path.relative(process.cwd(), REPORT_PATH)}`);

  if (failCount > 0) process.exit(1);
}

main();
