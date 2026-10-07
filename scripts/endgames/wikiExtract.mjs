// Extracts {{Chess diagram}} / {{Chess diagram small}} templates from raw
// Wikipedia wikitext and converts each to a FEN piece-placement string plus
// its caption text. Pipe-splitting tracks {{ }}, [[ ]] and <ref>...</ref>
// nesting depth so a nested {{cite web |url=...}} inside a caption doesn't
// get mistaken for the outer template's own field separators.
import { readFileSync } from "node:fs";

const NAMED_PARAM = /^\s*(size|numbers|letters|reverse|flip)\s*=/i;

function splitTopLevelFields(body) {
  const fields = [];
  let current = "";
  let depth = 0;
  let i = 0;
  while (i < body.length) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      current += two;
      i += 2;
      continue;
    }
    if (two === "}}" || two === "]]") {
      depth--;
      current += two;
      i += 2;
      continue;
    }
    const refOpen = /^<ref\b[^>]*?(?<!\/)>/i.exec(body.slice(i));
    if (refOpen && refOpen.index === 0) {
      depth++;
      current += refOpen[0];
      i += refOpen[0].length;
      continue;
    }
    if (body.slice(i, i + 6).toLowerCase() === "</ref>") {
      depth--;
      current += body.slice(i, i + 6);
      i += 6;
      continue;
    }
    if (body[i] === "|" && depth === 0) {
      fields.push(current);
      current = "";
      i++;
      continue;
    }
    current += body[i];
    i++;
  }
  fields.push(current);
  return fields;
}

/** Finds every top-level {{...}} span starting with one of `names` (case-insensitive), brace-balanced. */
function findTemplateSpans(text, names) {
  const lowerNames = names.map((n) => n.toLowerCase());
  const spans = [];
  const re = /\{\{\s*/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index;
    const afterBrace = m.index + m[0].length;
    const nameMatch = /^[A-Za-z][A-Za-z0-9 _-]*/.exec(text.slice(afterBrace));
    if (!nameMatch) continue;
    const name = nameMatch[0].trim().toLowerCase().replace(/_/g, " ");
    if (!lowerNames.includes(name)) continue;
    // Walk forward tracking brace depth to find the matching close.
    let depth = 1;
    let i = start + 2;
    while (i < text.length && depth > 0) {
      const two = text.slice(i, i + 2);
      if (two === "{{") {
        depth++;
        i += 2;
        continue;
      }
      if (two === "}}") {
        depth--;
        i += 2;
        continue;
      }
      i++;
    }
    spans.push({ start, end: i, name, text: text.slice(start, i) });
    re.lastIndex = i;
  }
  return spans;
}

function squareToFenChar(raw) {
  const v = raw.trim().toLowerCase().replace(/_/g, "");
  if (v === "") return null;
  const piece = v[0];
  const color = v[1];
  if (!"kqrbnp".includes(piece) || (color !== "l" && color !== "d")) {
    throw new Error(`unrecognised square token "${raw}"`);
  }
  return color === "l" ? piece.toUpperCase() : piece;
}

function squaresToFenPlacement(squares) {
  const ranks = [];
  for (let r = 0; r < 8; r++) {
    let rank = "";
    let empties = 0;
    for (let c = 0; c < 8; c++) {
      const ch = squareToFenChar(squares[r * 8 + c]);
      if (ch === null) {
        empties++;
      } else {
        if (empties > 0) {
          rank += empties;
          empties = 0;
        }
        rank += ch;
      }
    }
    if (empties > 0) rank += empties;
    ranks.push(rank);
  }
  return ranks.join("/");
}

export function extractDiagrams(wikitext, names = ["chess diagram", "chess diagram small"]) {
  const spans = findTemplateSpans(wikitext, names);
  const results = [];
  for (const span of spans) {
    const inner = span.text.slice(2, -2); // strip outer {{ }}
    const nameLen = span.name.length;
    // inner starts with the template name (possibly different original casing/spacing); drop it.
    const afterName = inner.replace(/^[A-Za-z][A-Za-z0-9 _-]*/, "");
    let fields = splitTopLevelFields(afterName);
    // fields[0] is "" artifact before the first top-level "|". Drop named params wherever they occur.
    fields = fields.filter((f) => !NAMED_PARAM.test(f));
    if (fields.length < 1 + 64 + 1) {
      results.push({ ok: false, error: `only ${fields.length} usable fields`, raw: span.text });
      continue;
    }
    const caption = fields[fields.length - 1];
    const squares = fields.slice(fields.length - 1 - 64, fields.length - 1);
    try {
      const placement = squaresToFenPlacement(squares);
      results.push({ ok: true, placement, caption, raw: span.text });
    } catch (err) {
      results.push({ ok: false, error: err.message, raw: span.text });
    }
  }
  return results;
}

/**
 * Wikibooks' Chess/The Endgame pages use an older, row-per-line layout of
 * the same template: each rank is "|<label junk>|sq|sq|sq|sq|sq|sq|sq|sq|="
 * with the trailing "=" merging into the next line's label. That's 1 junk
 * field + 8 square fields per rank, 8 ranks, preceded by 4 header/junk
 * fields and followed by 1 coordinate-line junk field and the caption.
 */
export function extractLegacyRowDiagrams(wikitext, names = ["chess diagram"]) {
  const spans = findTemplateSpans(wikitext, names);
  const results = [];
  for (const span of spans) {
    const inner = span.text.slice(2, -2);
    const afterName = inner.replace(/^[A-Za-z][A-Za-z0-9 _-]*/, "");
    const fields = splitTopLevelFields(afterName);
    const expectedTotal = 4 + 8 * 9 + 1 + 1;
    if (fields.length !== expectedTotal) {
      results.push({ ok: false, error: `expected ${expectedTotal} fields, got ${fields.length}`, raw: span.text });
      continue;
    }
    const caption = fields[fields.length - 1];
    const rowsStart = 4;
    const squares = [];
    for (let r = 0; r < 8; r++) {
      const group = fields.slice(rowsStart + r * 9, rowsStart + r * 9 + 9);
      squares.push(...group.slice(1));
    }
    const normalized = squares.map((s) => (s.trim().toLowerCase() === "xx" ? "" : s));
    try {
      const placement = squaresToFenPlacement(normalized);
      results.push({ ok: true, placement, caption, raw: span.text });
    } catch (err) {
      results.push({ ok: false, error: err.message, raw: span.text });
    }
  }
  return results;
}

export function detectSideToMove(caption) {
  const plain = caption.replace(/<[^>]+>/g, " ");
  if (/\bwhite\s+to\s+(move|play)\b/i.test(plain)) return "w";
  if (/\bblack\s+to\s+(move|play)\b/i.test(plain)) return "b";
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = readFileSync(process.argv[2], "utf8");
  const diagrams = extractDiagrams(text);
  diagrams.forEach((d, i) => {
    if (!d.ok) {
      console.log(`#${i + 1} FAILED: ${d.error}`);
      return;
    }
    const side = detectSideToMove(d.caption);
    console.log(`#${i + 1} placement=${d.placement} side=${side ?? "?"} caption=${d.caption.replace(/\s+/g, " ").slice(0, 90)}`);
  });
}
