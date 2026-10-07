// "Not lost for the side to move" checks -- SPEC_endgames_catalog.md Part
// 1d rule 4. Tablebase for 7 pieces or fewer (one request at a time, two
// mirror hosts with retry); Stockfish depth 16 for 8 or more (several
// engine instances in parallel, one thread each).
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, "sfWorker.mjs");

const TABLEBASE_HOSTS = ["https://tablebase.lichess.ovh/standard?fen=", "https://tablebase.lichess.org/standard?fen="];
const LOST_CATEGORIES = new Set(["loss", "maybe-loss", "blessed-loss"]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function queryTablebaseOnce(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return body.category ?? null;
}

let tablebaseQueue = Promise.resolve();

/** Tablebase calls stay one at a time (spec Part 1d), however many callers are waiting. */
export function tablebaseCategory(fen) {
  const run = async () => {
    let lastErr;
    for (const base of TABLEBASE_HOSTS) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await queryTablebaseOnce(`${base}${encodeURIComponent(fen)}`);
        } catch (err) {
          lastErr = err;
          await sleep(1000 * (attempt + 1));
        }
      }
    }
    throw lastErr ?? new Error("tablebase unreachable");
  };
  const result = tablebaseQueue.then(run);
  tablebaseQueue = result.then(
    () => sleep(300),
    () => sleep(300),
  );
  return result;
}

/** True if the side to move is not lost, per the tablebase category. */
export function tablebaseOk(category) {
  return !LOST_CATEGORIES.has(category);
}

/** A small concurrency gate -- at most `limit` callbacks running at once. */
function createLimiter(limit) {
  let active = 0;
  const queue = [];
  function next() {
    if (active >= limit || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  }
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

const WORKER_CONCURRENCY = Math.max(1, (os.availableParallelism?.() ?? 4) - 1);
const limit = createLimiter(WORKER_CONCURRENCY);

/** Centipawns, from the side-to-move's own perspective, at the given FEN -- run in its own process (see sfWorker.mjs). */
export async function stockfishEval(fen, depth = 16) {
  return limit(
    () =>
      new Promise((resolve, reject) => {
        execFile("node", [WORKER_PATH, fen, String(depth)], { timeout: 35000 }, (err, stdout) => {
          if (err) return reject(err);
          const m = /\{"score":-?\d+\}|\{"score":null\}/.exec(stdout);
          if (!m) return reject(new Error(`no score in worker output: ${stdout.slice(-200)}`));
          resolve(JSON.parse(m[0]).score);
        });
      }),
  );
}

/**
 * Rule 4: not lost for the side to move. 7 pieces or fewer go to the
 * tablebase; 8 or more get a depth-16 Stockfish eval, which must be at
 * least -1.5 pawns (-150cp).
 */
export async function checkNotLost(fen, pieceCount) {
  if (pieceCount <= 7) {
    const category = await tablebaseCategory(fen);
    return { ok: tablebaseOk(category), detail: category ?? "unreachable" };
  }
  const cp = await stockfishEval(fen);
  return { ok: cp !== null && cp >= -150, detail: cp === null ? "no eval" : `${(cp / 100).toFixed(2)}cp` };
}

