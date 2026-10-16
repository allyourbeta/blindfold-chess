#!/usr/bin/env node
// SPEC_position_command.md Part 2 -- `npm run pos -- add|delete|list`, the
// one laptop command for curating the hand-picked endgame catalog. Owns
// all I/O (reading/writing sources.json/codes.json, recognition, the
// preview, confirmation, the build, the data tests, and the commit/push);
// positions.mjs owns the pure add/delete/list logic.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { addEntry, deleteEntry, listEntries } from "./positions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SOURCES_PATH = path.resolve(__dirname, "sources.json");
const CODES_PATH = path.resolve(__dirname, "codes.json");
const PIECES_DIR = path.resolve(REPO_ROOT, "public/pieces");

const OCR_BASE = "http://localhost:8000";

function readManifestAndCodes() {
  const manifest = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
  const codes = JSON.parse(readFileSync(CODES_PATH, "utf8"));
  return { manifest, codes };
}

function runInherited(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: REPO_ROOT, stdio: "inherit" });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${res.status}`);
}

function restoreFromGit() {
  runInherited("git", ["checkout", "--", "scripts/endgames/sources.json", "scripts/endgames/codes.json", "src/data/endgames.json"]);
}

/** Writes sources.json/codes.json, builds, runs the fast data tests, and on success commits + pushes. */
function finalizeChange(manifest, codes, commitMessage) {
  writeFileSync(SOURCES_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(CODES_PATH, `${JSON.stringify(codes, null, 2)}\n`);

  try {
    runInherited("npm", ["run", "endgames:build"]);
    runInherited("npx", [
      "vitest",
      "run",
      "src/services/endgames/catalogShipped.test.ts",
      "src/services/endgames/catalogShippedResults.test.ts",
    ]);
  } catch (err) {
    console.error(`\nBuild or data checks failed: ${err.message}`);
    console.error("Restoring sources.json, codes.json and src/data/endgames.json from git.");
    restoreFromGit();
    process.exit(1);
  }

  runInherited("git", ["add", "scripts/endgames/sources.json", "scripts/endgames/codes.json", "src/data/endgames.json"]);
  runInherited("git", ["commit", "-m", commitMessage]);
  runInherited("git", ["push"]);
  console.log(`\n${commitMessage} -- committed and pushed.`);
}

async function confirm(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(prompt);
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

async function ocrStatus() {
  try {
    const res = await fetch(`${OCR_BASE}/api/ocr/status`);
    if (!res.ok) return { ok: false };
    const body = await res.json();
    return { ok: body.models_present === true };
  } catch {
    return { ok: false };
  }
}

async function recognize(imagePath) {
  const image_base64 = readFileSync(imagePath).toString("base64");
  const res = await fetch(`${OCR_BASE}/api/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64 }),
  });
  if (!res.ok) throw new Error(`chessdirbek OCR failed: HTTP ${res.status}`);
  return res.json();
}

/** Writes the macOS clipboard's image (PNG, or TIFF as a fallback) to a temp file, or null when it holds no image. */
function clipboardImagePath() {
  const base = path.join(os.tmpdir(), `pos-clipboard-${process.pid}-${Date.now()}`);
  const pngPath = `${base}.png`;
  const tiffPath = `${base}.tiff`;
  const script = `
    try
      set theData to the clipboard as «class PNGf»
      set theFile to open for access (POSIX file "${pngPath}") with write permission
      set eof theFile to 0
      write theData to theFile
      close access theFile
      return "PNG"
    on error
      try
        set theData to the clipboard as TIFF picture
        set theFile to open for access (POSIX file "${tiffPath}") with write permission
        set eof theFile to 0
        write theData to theFile
        close access theFile
        return "TIFF"
      on error
        return "NONE"
      end try
    end try
  `;
  const result = execFileSync("osascript", ["-e", script], { encoding: "utf8" }).trim();
  if (result === "PNG") return pngPath;
  if (result === "TIFF") return tiffPath;
  return null;
}

function expandRank(rank) {
  const squares = [];
  for (const ch of rank) {
    if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) squares.push(null);
    else squares.push(ch);
  }
  return squares;
}

/** Rows top-to-bottom as the side to move would see the board (White's own view needs no flip). */
function boardRows(placement, sideToMove) {
  const ranks = placement.split("/").map(expandRank);
  if (sideToMove === "w") return ranks;
  return [...ranks].reverse().map((row) => [...row].reverse());
}

function pieceSquareHtml(cell) {
  if (!cell) return "";
  const isWhite = cell === cell.toUpperCase();
  const fileName = `${isWhite ? "w" : "b"}${cell.toUpperCase()}.svg`;
  const href = pathToFileURL(path.join(PIECES_DIR, fileName)).href;
  return `<img src="${href}" alt="${cell}">`;
}

function renderPreviewHtml({ placement, sideToMove, code, action }) {
  const rows = boardRows(placement, sideToMove);
  const squares = rows
    .map((row, r) =>
      row
        .map((cell, c) => {
          const shade = (r + c) % 2 === 0 ? "light" : "dark";
          return `<div class="sq ${shade}">${pieceSquareHtml(cell)}</div>`;
        })
        .join(""),
    )
    .join("");
  const sideLabel = sideToMove === "b" ? "Black" : "White";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${code} -- ${action}</title>
<style>
  body { font-family: system-ui, sans-serif; background: #1b1b1b; color: #eee; display: flex; flex-direction: column; align-items: center; padding: 2rem; }
  .board { display: grid; grid-template-columns: repeat(8, 64px); grid-template-rows: repeat(8, 64px); border: 2px solid #444; }
  .sq { width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; }
  .light { background: #eeeed2; }
  .dark { background: #769656; }
  img { width: 56px; height: 56px; }
  .caption { margin-top: 1rem; font-size: 1.1rem; text-align: center; }
  .fen { font-family: ui-monospace, monospace; font-size: 0.9rem; opacity: 0.8; margin-top: 0.25rem; }
</style>
</head>
<body>
  <div class="board">${squares}</div>
  <div class="caption"><strong>${code}</strong> &mdash; ${sideLabel} to move (${action})</div>
  <div class="fen">${placement} ${sideToMove}</div>
</body>
</html>
`;
}

function showPreview({ placement, sideToMove, code, action }) {
  const html = renderPreviewHtml({ placement, sideToMove, code, action });
  const htmlPath = path.join(os.tmpdir(), `pos-preview-${process.pid}-${Date.now()}.html`);
  writeFileSync(htmlPath, html);
  spawnSync("open", [htmlPath]);
  return htmlPath;
}

function parseAddArgs(args) {
  let black = false;
  let fen = null;
  let imagePath = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--black") black = true;
    else if (a === "--fen") fen = args[++i];
    else if (imagePath === null && !a.startsWith("--")) imagePath = a;
  }
  return { black, fen, imagePath };
}

async function cmdAdd(args) {
  const { black, fen, imagePath } = parseAddArgs(args);
  const sideToMove = black ? "b" : "w";

  let placement;
  if (fen) {
    placement = fen;
  } else {
    const status = await ocrStatus();
    if (!status.ok) {
      console.error("Start chessdirbek first (http://localhost:8000).");
      process.exit(1);
    }
    const resolvedPath = imagePath ?? clipboardImagePath();
    if (!resolvedPath) {
      console.error("Clipboard holds no image.");
      process.exit(1);
    }
    const recognized = await recognize(resolvedPath);
    placement = recognized.fen.split(" ")[0];
  }

  const { manifest, codes } = readManifestAndCodes();
  let proposed;
  try {
    proposed = addEntry(manifest, codes, { placement, sideToMove });
  } catch (err) {
    console.error(`Refused: ${err.message}`);
    process.exit(1);
  }

  showPreview({ placement, sideToMove, code: proposed.code, action: "add" });
  const yes = await confirm(`Add as ${proposed.code} (${sideToMove === "b" ? "Black" : "White"} to move)? [y/N] `);
  if (!yes) {
    console.log("Cancelled; nothing changed.");
    return;
  }

  finalizeChange(proposed.manifest, proposed.codes, `Endgames: add ${proposed.code}`);
}

async function cmdDelete(args) {
  const code = args[0];
  if (!code) {
    console.error("Usage: npm run pos -- delete E287");
    process.exit(1);
  }

  const { manifest, codes } = readManifestAndCodes();
  const entry = manifest.find((e) => e.code === code);
  if (!entry) {
    console.error(`Refused: no entry with code ${code}`);
    process.exit(1);
  }

  let result;
  try {
    result = deleteEntry(manifest, codes, code);
  } catch (err) {
    console.error(`Refused: ${err.message}`);
    process.exit(1);
  }

  showPreview({ placement: entry.extract.placement, sideToMove: entry.extract.sideToMove, code, action: "delete" });
  const yes = await confirm(`Delete ${code}? [y/N] `);
  if (!yes) {
    console.log("Cancelled; nothing changed.");
    return;
  }

  finalizeChange(result.manifest, result.codes, `Endgames: delete ${code}`);
}

function cmdList() {
  const { manifest } = readManifestAndCodes();
  for (const row of listEntries(manifest)) {
    const side = row.sideToMove === "b" ? "Black" : "White";
    console.log(`${row.code}  ${side.padEnd(5)}  ${row.pieces} pieces`);
  }
}

async function main() {
  const [action, ...rest] = process.argv.slice(2);
  if (action === "add") return cmdAdd(rest);
  if (action === "delete") return cmdDelete(rest);
  if (action === "list") return cmdList();
  console.error("Usage: npm run pos -- add|delete|list ...");
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
