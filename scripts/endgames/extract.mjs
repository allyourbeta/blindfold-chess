// Dispatches a manifest entry's `extract` recipe to the right extraction
// routine. Every routine re-derives the position from freshly fetched (or
// cached) real source text -- never from a value stored in sources.json.
import { Chess } from "chess.js";
import { fetchText, wikiRawUrl } from "./fetchCache.mjs";
import { extractDiagrams, extractLegacyRowDiagrams, detectSideToMove } from "./wikiExtract.mjs";

/** `kind: "wiki-diagram"`. `host`/`style` pick the template dialect; see wikiExtract.mjs. */
async function extractWikiDiagram({ host, page, index, sideToMove, style }) {
  const text = await fetchText(wikiRawUrl(host, page));
  const diagrams = style === "legacy-row" ? extractLegacyRowDiagrams(text) : extractDiagrams(text);
  const d = diagrams[index];
  if (!d || !d.ok) throw new Error(`${host}/${page} diagram #${index + 1} not extractable: ${d?.error ?? "missing"}`);
  const detected = detectSideToMove(d.caption);
  if (detected !== sideToMove) {
    throw new Error(`${host}/${page} diagram #${index + 1}: caption says side-to-move "${detected}", manifest says "${sideToMove}"`);
  }
  return { placement: d.placement, sideToMove };
}

/** `kind: "embedded-fen"`. ChessBase articles embed a literal `data-fen="..."` or PGN `[FEN "..."]` tag. */
async function extractEmbeddedFen({ pageUrl, index }) {
  const html = await fetchText(pageUrl);
  const matches = [...html.matchAll(/data-fen="([^"]+)"/g), ...html.matchAll(/\[FEN\s+"([^"]+)"\]/g)];
  const m = matches[index];
  if (!m) throw new Error(`${pageUrl}: no embedded FEN at index ${index} (found ${matches.length})`);
  const fields = m[1].trim().split(/\s+/);
  return { placement: fields[0], sideToMove: fields[1] === "b" ? "b" : "w" };
}

/** `kind: "pgn-ply"`. Replays a real PGN's `game`-th game to the position after `ply` half-moves. */
async function extractPgnPly({ pgnUrl, game, ply }) {
  const text = await fetchText(pgnUrl);
  const games = splitPgnGames(text);
  const pgn = games[game];
  if (!pgn) throw new Error(`${pgnUrl}: no game at index ${game} (found ${games.length})`);
  const chess = new Chess();
  chess.loadPgn(stripClock(pgn));
  const history = chess.history({ verbose: true });
  if (ply > history.length) throw new Error(`${pgnUrl} game ${game}: only ${history.length} plies, asked for ${ply}`);
  const replay = new Chess();
  for (let i = 0; i < ply; i++) replay.move(history[i].san);
  const [placement, sideToMove] = replay.fen().split(" ");
  return { placement, sideToMove };
}

function stripClock(pgn) {
  return pgn.replace(/\{[^}]*\}/g, "");
}

/** A multi-game PGN file is games separated by a blank line after one ends in a result token. */
function splitPgnGames(text) {
  const blocks = text.split(/\n\s*\n(?=\[Event)/).map((b) => b.trim()).filter(Boolean);
  return blocks;
}

export async function extractFromRecipe(extract) {
  switch (extract.kind) {
    case "wiki-diagram":
      return extractWikiDiagram(extract);
    case "embedded-fen":
      return extractEmbeddedFen(extract);
    case "pgn-ply":
      return extractPgnPly(extract);
    default:
      throw new Error(`unknown extract kind "${extract.kind}"`);
  }
}
