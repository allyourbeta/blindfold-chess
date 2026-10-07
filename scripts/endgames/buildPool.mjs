// Harvests every usable candidate position from the real sources in
// sourceList.mjs. Each candidate carries the `extract` recipe that will go
// into sources.json -- never a value trusted without re-derivation later.
import { Chess } from "chess.js";
import { fetchText, wikiRawUrl } from "./fetchCache.mjs";
import { extractDiagrams, extractLegacyRowDiagrams, detectSideToMove } from "./wikiExtract.mjs";
import {
  WIKI_PAGES,
  WIKIBOOKS_PAGES,
  CHESSBASE_PAGES,
  LICHESS_GAMES,
  PGNMENTOR_FILES,
  LICHESS_BULK_EXPORTS,
} from "./sourceList.mjs";
import { pieceCount, bucketFor, toCanonicalFen } from "./curationHelpers.mjs";
import { isQuiet } from "./quiet.mjs";

function titleFromWikiPage(host, page) {
  const url = `https://${host}/wiki/${page.replace(/ /g, "_")}`;
  const niceTitle = page.replace(/_/g, " ").split("/").pop();
  return { title: niceTitle, url };
}

async function harvestWikiDiagrams(host, page, style) {
  const text = await fetchText(wikiRawUrl(host, page));
  const diagrams = style === "legacy-row" ? extractLegacyRowDiagrams(text) : extractDiagrams(text);
  const { title, url } = titleFromWikiPage(host, page);
  const out = [];
  diagrams.forEach((d, index) => {
    if (!d.ok) return;
    const sideToMove = detectSideToMove(d.caption);
    if (!sideToMove) return;
    out.push({
      placement: d.placement,
      sideToMove,
      name: null,
      themes: [],
      sourceTitle: title,
      sourceUrl: url,
      host,
      caption: d.caption.replace(/\s+/g, " ").trim(),
      recipe: { kind: "wiki-diagram", host, page, index, sideToMove, ...(style === "legacy-row" ? { style } : {}) },
    });
  });
  return out;
}

async function harvestChessBase({ url, title }) {
  const html = await fetchText(url);
  const matches = [...html.matchAll(/data-fen="([^"]+)"/g), ...html.matchAll(/\[FEN\s+"([^"]+)"\]/g)];
  const out = [];
  matches.forEach((m, index) => {
    const fields = m[1].trim().split(/\s+/);
    if (fields.length < 2) return;
    out.push({
      placement: fields[0],
      sideToMove: fields[1] === "b" ? "b" : "w",
      name: null,
      themes: [],
      sourceTitle: title,
      sourceUrl: url,
      host: new URL(url).host,
      caption: "",
      recipe: { kind: "embedded-fen", pageUrl: url, index },
    });
  });
  return out;
}

function stripClock(pgn) {
  return pgn.replace(/\{[^}]*\}/g, "");
}

function splitPgnGames(text) {
  return text
    .split(/\n\s*\n(?=\[Event)/)
    .map((b) => b.trim())
    .filter(Boolean);
}

function headerValue(pgn, tag) {
  const m = new RegExp(`\\[${tag} "([^"]*)"\\]`).exec(pgn);
  return m ? m[1] : "";
}

/**
 * Scans one real game's full move list for plies landing in the 3-16 piece
 * window. Picks are spread across whichever size buckets the game actually
 * passes through (at most `perBucket` per bucket, spaced out within it) --
 * a flat "first N plies" cap would only ever catch the earliest bucket a
 * long grinding endgame reaches and starve the smaller ones.
 */
function scanGameForCandidates(pgn, pgnUrl, gameIndex, sourceTitle, host, perBucket) {
  let chess;
  try {
    chess = new Chess();
    chess.loadPgn(stripClock(pgn));
  } catch {
    return [];
  }
  const history = chess.history({ verbose: true });
  const white = headerValue(pgn, "White");
  const black = headerValue(pgn, "Black");
  const event = headerValue(pgn, "Event");
  const replay = new Chess();
  const lastTakenByBucket = {};
  const out = [];
  for (let ply = 0; ply < history.length; ply++) {
    replay.move(history[ply].san);
    const fen = replay.fen();
    const [placement, sideToMove] = fen.split(" ");
    const count = pieceCount(fen);
    const bucket = bucketFor(count);
    if (!bucket) continue;
    if (replay.isGameOver()) continue;
    const taken = out.filter((c) => c.bucketLabel === bucket.label).length;
    if (taken >= perBucket) continue;
    const last = lastTakenByBucket[bucket.label] ?? -999;
    if (ply - last < 6) continue;
    lastTakenByBucket[bucket.label] = ply;
    out.push({
      placement,
      sideToMove,
      name: null,
      themes: [],
      sourceTitle,
      sourceUrl: pgnUrl,
      host,
      caption: `${white} vs. ${black}, ${event}, ply ${ply + 1}`,
      recipe: { kind: "pgn-ply", pgnUrl, game: gameIndex, ply: ply + 1 },
      bucketLabel: bucket.label,
    });
  }
  return out.map(({ bucketLabel, ...rest }) => rest);
}

async function harvestLichessGame({ gameId, title }) {
  const pgnUrl = `https://lichess.org/game/export/${gameId}.pgn`;
  const text = await fetchText(pgnUrl);
  return scanGameForCandidates(text, pgnUrl, 0, title, "lichess.org", 3);
}

async function harvestPgnMentorFile({ path: filePath, title }) {
  const pgnUrl = `https://www.pgnmentor.com/${filePath}`;
  const text = await fetchText(pgnUrl);
  const games = splitPgnGames(text);
  const out = [];
  games.forEach((pgn, gameIndex) => {
    const white = headerValue(pgn, "White") || "?";
    const black = headerValue(pgn, "Black") || "?";
    const event = headerValue(pgn, "Event") || title;
    const perGameTitle = `${title}: ${white} vs. ${black}`;
    out.push(...scanGameForCandidates(pgn, pgnUrl, gameIndex, perGameTitle, "www.pgnmentor.com", 2));
  });
  return out;
}

async function harvestLichessBulkExport({ username, max, until, title }) {
  const pgnUrl = `https://lichess.org/api/games/user/${username}?max=${max}&until=${until}&pgnInJson=false&clocks=false&evals=false`;
  const text = await fetchText(pgnUrl);
  const games = splitPgnGames(text);
  const out = [];
  games.forEach((pgn, gameIndex) => {
    const date = headerValue(pgn, "UTCDate") || headerValue(pgn, "Date");
    const white = headerValue(pgn, "White") || "?";
    const black = headerValue(pgn, "Black") || "?";
    const perGameTitle = `${title}: ${white} vs. ${black}, ${date}`;
    out.push(...scanGameForCandidates(pgn, pgnUrl, gameIndex, perGameTitle, "lichess.org", 2));
  });
  return out;
}

export async function buildPool() {
  const pool = [];
  for (const page of WIKI_PAGES) pool.push(...(await harvestWikiDiagrams("en.wikipedia.org", page, "modern")));
  for (const page of WIKIBOOKS_PAGES) pool.push(...(await harvestWikiDiagrams("en.wikibooks.org", page, "legacy-row")));
  for (const cb of CHESSBASE_PAGES) pool.push(...(await harvestChessBase(cb)));
  for (const g of LICHESS_GAMES) pool.push(...(await harvestLichessGame(g)));
  for (const f of PGNMENTOR_FILES) pool.push(...(await harvestPgnMentorFile(f)));
  for (const b of LICHESS_BULK_EXPORTS) pool.push(...(await harvestLichessBulkExport(b)));
  // SPEC_endgames_quiet.md: drop any candidate that lets the side to move
  // grab material for free, so a re-run of curate.mjs can't bring one back
  // in. A candidate with an illegal placement (missing king, etc.) is left
  // for curate.mjs's own legality filter to drop instead of failing here.
  return pool.filter((c) => {
    try {
      return isQuiet(toCanonicalFen(c.placement, c.sideToMove));
    } catch {
      return true;
    }
  });
}
