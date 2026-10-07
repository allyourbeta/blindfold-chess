#!/usr/bin/env node
// One-off sourcing tool (not part of the regular build/verify pipeline):
// harvests real candidate positions, selects a balanced catalog from them,
// liveness-checks the selection, and writes scripts/endgames/sources.json
// -- the manifest build.mjs will later execute for real.
import { writeFileSync } from "node:fs";
import { Chess } from "chess.js";
import { buildPool } from "./buildPool.mjs";
import { selectCatalog, BUCKET_MAX } from "./selectCatalog.mjs";
import { pieceCount, toCanonicalFen, materialKey, family, bucketFor } from "./curationHelpers.mjs";
import { checkNotLost } from "./liveness.mjs";

const NAMED_PAGES = new Map([
  ["Lucena position", "Lucena position"],
  ["Philidor position", "Philidor position"],
]);

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assignNames(selected) {
  const used = new Set();
  for (const c of selected) {
    const page = c.recipe.kind === "wiki-diagram" ? c.recipe.page : null;
    const nice = page ? NAMED_PAGES.get(page) : null;
    if (nice && !used.has(nice)) {
      c.name = nice;
      used.add(nice);
    }
  }
}

function assignIds(selected) {
  const counts = new Map();
  for (const c of selected) {
    const base = c.name ? slugify(c.name) : `${slugify(c.bucket)}-${slugify(c.fam)}`;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    c.id = n === 1 ? base : `${base}-${n}`;
  }
}

/** Drops surplus entries in a bucket back down to its spec max, keeping the black/white split balanced. */
function trimToSpecMax(selected) {
  const out = [];
  for (const bucket of Object.keys(BUCKET_MAX)) {
    const inBucket = selected.filter((c) => c.bucket === bucket);
    const max = BUCKET_MAX[bucket];
    if (inBucket.length <= max) {
      out.push(...inBucket);
      continue;
    }
    const white = inBucket.filter((c) => c.sideToMove === "w");
    const black = inBucket.filter((c) => c.sideToMove === "b");
    const halfMax = Math.ceil(max / 2);
    out.push(...white.slice(0, halfMax), ...black.slice(0, max - Math.min(halfMax, white.length)));
  }
  return out;
}

/** Drops a host's excess entries (oldest-selected first) until no host exceeds 40% of the final total. */
function trimHostShare(selected) {
  let current = [...selected];
  for (let guard = 0; guard < 10; guard++) {
    const cap = Math.floor(current.length * 0.4);
    const byHost = new Map();
    for (const c of current) byHost.set(c.host, [...(byHost.get(c.host) ?? []), c]);
    const offender = [...byHost.entries()].find(([, list]) => list.length > cap);
    if (!offender) break;
    const [, list] = offender;
    const toDrop = new Set(list.slice(cap));
    current = current.filter((c) => !toDrop.has(c));
  }
  return current;
}

async function runLiveness(selected) {
  const results = await Promise.all(
    selected.map(async (c) => {
      const fen = toCanonicalFen(c.placement, c.sideToMove);
      try {
        const { ok, detail } = await checkNotLost(fen, c.count);
        return { c, ok, detail };
      } catch (err) {
        return { c, ok: false, detail: err.message };
      }
    }),
  );
  return results;
}

function toManifestEntry(c) {
  const flip = !!c.flipped;
  return {
    id: c.id,
    name: c.name ?? null,
    themes: c.themes ?? [],
    source: { title: c.sourceTitle, url: c.sourceUrl },
    extract: c.recipe,
    flip,
  };
}

async function main() {
  console.log("Harvesting real candidate positions...");
  const rawPool = await buildPool();
  console.log(`Raw pool: ${rawPool.length} candidates`);

  const pool = [];
  for (const c of rawPool) {
    const fen = toCanonicalFen(c.placement, c.sideToMove);
    let chess;
    try {
      chess = new Chess(fen);
    } catch {
      continue;
    }
    if (chess.isGameOver()) continue;
    const count = pieceCount(fen);
    if (count < 3 || count > 16) continue;
    const key = materialKey(fen);
    const bucket = bucketFor(count);
    if (!bucket) continue;
    pool.push({ ...c, count, key, fam: family(key), bucket: bucket.label });
  }
  console.log(`Legal, in-bucket pool: ${pool.length}`);

  let selected = selectCatalog(pool);
  console.log(`Selected ${selected.length} before liveness check`);

  console.log("Running liveness checks (tablebase for <=7 pieces, Stockfish depth 16 for 8+)...");
  let liveness = await runLiveness(selected);
  let failures = liveness.filter((r) => !r.ok);
  console.log(`Liveness: ${liveness.length - failures.length} ok, ${failures.length} failed`);
  for (const f of failures) console.log(`  drop ${f.c.bucket} ${f.c.key} (${f.detail})`);
  const failedSet = new Set(failures.map((f) => f.c));
  selected = selected.filter((c) => !failedSet.has(c));

  selected = trimToSpecMax(selected);
  selected = trimHostShare(selected);

  assignNames(selected);
  assignIds(selected);

  const byBucket = {};
  const blackByBucket = {};
  for (const c of selected) {
    byBucket[c.bucket] = (byBucket[c.bucket] ?? 0) + 1;
    if (c.sideToMove === "b") blackByBucket[c.bucket] = (blackByBucket[c.bucket] ?? 0) + 1;
  }
  console.log("Final bucket counts:", byBucket);
  console.log("Black-to-move by bucket:", blackByBucket);
  const byHost = {};
  for (const c of selected) byHost[c.host] = (byHost[c.host] ?? 0) + 1;
  console.log("Final host counts:", byHost);
  const flippedTotal = selected.filter((c) => c.flipped).length;
  console.log("Flipped total:", flippedTotal, `(${((flippedTotal / selected.length) * 100).toFixed(1)}%)`);
  for (const bucket of Object.keys(byBucket)) {
    const inBucket = selected.filter((c) => c.bucket === bucket);
    const flipped = inBucket.filter((c) => c.flipped).length;
    console.log(`  ${bucket}: ${flipped}/${inBucket.length} flipped (${((flipped / inBucket.length) * 100).toFixed(1)}%)`);
  }
  console.log("Final total:", selected.length);

  const byKey = {};
  for (const c of selected) byKey[c.key] = (byKey[c.key] ?? 0) + 1;
  const overCap = Object.entries(byKey).filter(([, n]) => n > 8);
  console.log("Distinct material keys:", Object.keys(byKey).length, "over cap:", overCap);

  const coverage = {};
  for (const c of selected) {
    coverage[c.fam] ??= new Set();
    coverage[c.fam].add(c.bucket);
  }
  for (const [fam, buckets] of Object.entries(coverage)) {
    console.log(`family ${fam}: ${buckets.size}/4 buckets`);
  }

  const names = selected.map((c) => c.name).filter(Boolean);
  console.log("Named entries:", names.length, "unique:", new Set(names).size);

  const manifest = selected
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(toManifestEntry);

  writeFileSync(new URL("./sources.json", import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote sources.json with ${manifest.length} entries`);
}

main();
