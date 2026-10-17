// SPEC_pos_page_and_remove.md Part 2 -- the local "add a position" page.
// A tiny Node HTTP server, localhost only, serving posPage.html and three
// endpoints (/recognize, /check, /add). No list, no delete (decision 7) --
// deleting happens in the app, via the Remove API (Part 3).
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addEntry } from "./positions.mjs";
import { addFromPlacement, ocrStatus, recognizeBase64 } from "./pos.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PIECES_DIR = path.resolve(REPO_ROOT, "public/pieces");
const SOURCES_PATH = path.resolve(__dirname, "sources.json");
const CODES_PATH = path.resolve(__dirname, "codes.json");
const PAGE_PATH = path.resolve(__dirname, "posPage.html");

const HOST = "127.0.0.1";
const PORT = 5199;

function readManifestAndCodes() {
  const manifest = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
  const codes = JSON.parse(readFileSync(CODES_PATH, "utf8"));
  return { manifest, codes };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body, contentType = "application/json") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(contentType === "application/json" ? JSON.stringify(body) : body);
}

async function handleRecognize(req, res) {
  const body = await readJsonBody(req);
  const status = await ocrStatus();
  if (!status.ok) return send(res, 503, { error: "Start chessdirbek first (http://localhost:8000)." });
  const recognized = await recognizeBase64(body.image_base64);
  const placement = recognized.fen.split(" ")[0];
  send(res, 200, { placement });
}

function handleCheck(res, body) {
  const { manifest, codes } = readManifestAndCodes();
  try {
    const proposed = addEntry(manifest, codes, { placement: body.placement, sideToMove: body.sideToMove });
    send(res, 200, { ok: true, code: proposed.code });
  } catch (err) {
    send(res, 200, { ok: false, reason: err instanceof Error ? err.message : String(err) });
  }
}

async function handleAdd(res, body) {
  try {
    const result = await addFromPlacement({ placement: body.placement, sideToMove: body.sideToMove });
    send(res, 200, result);
  } catch (err) {
    send(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
}

function servePiece(res, name) {
  try {
    const file = readFileSync(path.join(PIECES_DIR, name));
    send(res, 200, file.toString(), "image/svg+xml");
  } catch {
    send(res, 404, "not found", "text/plain");
  }
}

export async function startPosPage() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${HOST}`);
      if (req.method === "GET" && url.pathname === "/") {
        return send(res, 200, readFileSync(PAGE_PATH, "utf8"), "text/html");
      }
      if (req.method === "GET" && url.pathname.startsWith("/pieces/")) {
        return servePiece(res, path.basename(url.pathname));
      }
      if (req.method === "POST" && url.pathname === "/recognize") {
        return await handleRecognize(req, res);
      }
      if (req.method === "POST" && url.pathname === "/check") {
        return handleCheck(res, await readJsonBody(req));
      }
      if (req.method === "POST" && url.pathname === "/add") {
        return await handleAdd(res, await readJsonBody(req));
      }
      send(res, 404, { error: "not found" });
    } catch (err) {
      send(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  await new Promise((resolve) => server.listen(PORT, HOST, resolve));
  const url = `http://${HOST}:${PORT}/`;
  console.log(`Add-a-position page: ${url}`);
  // Skipped for the automated live check (CLAUDE.md: never drive Ashish's
  // own browser) -- POS_PAGE_SKIP_OPEN=1 leaves opening it to the caller.
  if (process.env.POS_PAGE_SKIP_OPEN !== "1") spawnSync("open", [url]);
  return server;
}
