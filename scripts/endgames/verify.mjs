#!/usr/bin/env node
// Checks every src/data/endgames.json FEN against the Lichess tablebase and
// confirms `goal` (the side to move's view) actually matches it. The
// catalog's goal is never trusted from a source caption -- this is the one
// place it's trusted at all. See SPEC_endgames.md Part 1d.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../../src/data/endgames.json");
const DELAY_MS = 300;
const FIX = process.argv.includes("--fix");

const HOSTS = ["https://tablebase.lichess.ovh/standard?fen=", "https://tablebase.lichess.org/standard?fen="];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A single transient hiccup (rate limit, dropped connection) must never
// silently reject a good position -- each host gets its own retry with a
// backoff before falling through to the next host.
async function queryTablebaseOnce(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return body.category ?? null;
}

async function queryTablebase(fen) {
  let lastErr;
  for (const base of HOSTS) {
    const url = `${base}${encodeURIComponent(fen)}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await queryTablebaseOnce(url);
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await sleep(1000 * (attempt + 1));
      }
    }
  }
  throw lastErr ?? new Error("tablebase unreachable");
}

function expectedGoal(category) {
  if (category === "win") return "win";
  if (category === "draw") return "draw";
  return null; // loss, cursed-win, blessed-loss, maybe-*, unknown, or a failed lookup
}

async function main() {
  const catalog = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const kept = [];
  const rejected = [];

  for (const entry of catalog) {
    let category;
    try {
      category = await queryTablebase(entry.fen);
    } catch (err) {
      category = `unreachable (${err instanceof Error ? err.message : String(err)})`;
    }
    const goal = expectedGoal(category);

    if (goal === null) {
      rejected.push({ entry, category });
    } else if (goal !== entry.goal) {
      if (FIX) {
        kept.push({ ...entry, goal });
        console.log(`fix  ${entry.id}: goal ${entry.goal} -> ${goal} (tablebase says ${category})`);
      } else {
        rejected.push({ entry, category });
      }
    } else {
      kept.push(entry);
    }
    await sleep(DELAY_MS);
  }

  if (FIX) {
    writeFileSync(DATA_PATH, `${JSON.stringify(kept, null, 2)}\n`);
  }

  console.log(`\n${kept.length} kept, ${rejected.length} rejected (of ${catalog.length} total)`);
  for (const { entry, category } of rejected) {
    console.log(`  reject ${entry.id} (${entry.fen}): tablebase says "${category}", catalog said "${entry.goal}"`);
  }

  if (!FIX && rejected.length > 0) process.exit(1);
}

main();
