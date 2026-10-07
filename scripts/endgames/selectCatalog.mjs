// Turns the raw candidate pool into a balanced, rule-compliant catalog
// selection. Every numbered rule below is from SPEC_endgames_catalog.md
// Part 1e.
import { mirrorColors } from "./mirror.mjs";
import { isNearCopy, toCanonicalFen } from "./curationHelpers.mjs";
import { isQuiet } from "./quiet.mjs";

// Selection deliberately oversamples well beyond the spec's final max per
// bucket -- curate.mjs's liveness check (not-lost for the side to move)
// then rejects a real fraction of real-game positions (more at the heavy
// end, where a ply landing mid-collapse is common), and curate.mjs trims
// back down to each bucket's spec max afterward. Trimming a surplus is
// simpler than iteratively topping up a shortfall.
export const BUCKET_MAX = {
  "3 to 5 pieces": 80,
  "6 to 8 pieces": 90,
  "9 to 11 pieces": 80,
  "12 to 16 pieces": 70,
};
const BUCKET_TARGETS = {
  "3 to 5 pieces": 110,
  "6 to 8 pieces": 130,
  "9 to 11 pieces": 130,
  "12 to 16 pieces": 130,
};
const MATERIAL_KEY_CAP = 8;
const HOST_SHARE_CAP = 0.4;
const FLIP_TOTAL_SHARE_CAP = 0.25;
const FLIP_BUCKET_SHARE_CAP = 0.35;

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deterministic PRNG so re-runs against an unchanged pool reproduce the same selection.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectCatalog(pool) {
  const rng = mulberry32(20261007);

  // SPEC_endgames_quiet.md: never select a candidate that lets the side to
  // move grab material for free -- belt-and-braces alongside buildPool.mjs's
  // own filter, so a re-run can't bring a non-quiet position back in.
  pool = pool.filter((c) => isQuiet(toCanonicalFen(c.placement, c.sideToMove)));

  const selected = [];
  const selectedPlacements = [];
  const keyCounts = new Map();
  // One global cap per host, at 40% of the whole catalog's target size --
  // the spec's host-share rule is over the whole catalog, not per bucket.
  const totalTarget = Object.values(BUCKET_TARGETS).reduce((a, b) => a + b, 0);
  const hostCap = Math.floor(totalTarget * HOST_SHARE_CAP);
  const hostCounts = new Map();
  const nameSeen = new Set();

  function fits(candidate) {
    if ((keyCounts.get(candidate.key) ?? 0) >= MATERIAL_KEY_CAP) return false;
    if ((hostCounts.get(candidate.host) ?? 0) >= hostCap) return false;
    if (candidate.name && nameSeen.has(candidate.name)) return false;
    for (const existing of selectedPlacements) {
      if (isNearCopy(candidate.placement, existing)) return false;
    }
    return true;
  }

  function accept(candidate) {
    selected.push(candidate);
    selectedPlacements.push(candidate.placement);
    keyCounts.set(candidate.key, (keyCounts.get(candidate.key) ?? 0) + 1);
    hostCounts.set(candidate.host, (hostCounts.get(candidate.host) ?? 0) + 1);
    if (candidate.name) nameSeen.add(candidate.name);
  }

  // Prefer material-key and host diversity: shuffle, then sort so a
  // key/host we've already taken plenty of sinks to the back.
  function priority(c) {
    return (keyCounts.get(c.key) ?? 0) * 10 + (hostCounts.get(c.host) ?? 0) / 10;
  }

  // Process scarcest-supply buckets first (12-16, then 9-11, ...) so a
  // host whose entries skew toward the heavy end isn't starved later by
  // 3-5/6-8 (which have ample Wikipedia supply) spending the shared cap.
  const processingOrder = ["12 to 16 pieces", "9 to 11 pieces", "6 to 8 pieces", "3 to 5 pieces"];
  for (const bucketLabel of processingOrder) {
    const target = BUCKET_TARGETS[bucketLabel];
    const candidates = shuffle(pool.filter((c) => c.bucket === bucketLabel), rng);
    let guard = 0;
    while (selected.filter((c) => c.bucket === bucketLabel).length < target && guard < 20) {
      guard++;
      const remaining = candidates
        .filter((c) => !selected.includes(c))
        .sort((a, b) => priority(a) - priority(b));
      let progressed = false;
      for (const c of remaining) {
        if (selected.filter((x) => x.bucket === bucketLabel).length >= target) break;
        if (!fits(c)) continue;
        accept(c);
        progressed = true;
      }
      if (!progressed) break;
    }
  }

  // Black-to-move balance, 40-60% per bucket, flip as a last resort.
  const flips = [];
  for (const bucketLabel of Object.keys(BUCKET_TARGETS)) {
    const inBucket = selected.filter((c) => c.bucket === bucketLabel);
    const blackCount = inBucket.filter((c) => c.sideToMove === "b").length;
    const need = Math.ceil(inBucket.length * 0.5) - blackCount;
    const bucketFlipCap = Math.floor(inBucket.length * FLIP_BUCKET_SHARE_CAP);
    if (need > 0) {
      const flippable = inBucket.filter((c) => c.sideToMove === "w" && !c.flipped).slice(0, Math.min(need, bucketFlipCap));
      for (const c of flippable) flips.push(c);
    } else if (need < 0) {
      const flippable = inBucket.filter((c) => c.sideToMove === "b" && !c.flipped).slice(0, Math.min(-need, bucketFlipCap));
      for (const c of flippable) flips.push(c);
    }
  }
  const flipTotalCap = Math.floor(selected.length * FLIP_TOTAL_SHARE_CAP);
  for (const c of flips.slice(0, flipTotalCap)) {
    const mirroredFen = mirrorColors(toCanonicalFen(c.placement, c.sideToMove));
    const [newPlacement, newSideToMove] = mirroredFen.split(" ");
    c.flipped = true;
    c.sourceFen = toCanonicalFen(c.placement, c.sideToMove);
    c.placement = newPlacement;
    c.sideToMove = newSideToMove;
  }

  return selected;
}
