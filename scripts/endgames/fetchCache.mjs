// Shared fetch-with-cache for every endgames script (curate, build, verify).
// Caching under .cache/ (gitignored) is what makes a re-run offline, per
// SPEC_endgames_catalog.md Part 1b.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.resolve(__dirname, ".cache", "raw");
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

const USER_AGENT = "blindfold-chess-endgames-sourcing/1.0 (contact: ashish@ashish.org; one-time sourcing run)";

function cacheKeyFor(url) {
  return url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 180) + ".cache";
}

/** Fetches `url` as text, serving from .cache/ on a repeat call. Politely rate-limited on a real fetch. */
export async function fetchText(url) {
  const cachePath = path.join(CACHE_DIR, cacheKeyFor(url));
  if (existsSync(cachePath)) return readFileSync(cachePath, "utf8");
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const text = await res.text();
  writeFileSync(cachePath, text);
  await new Promise((r) => setTimeout(r, 500));
  return text;
}

export function wikiRawUrl(host, page) {
  return `https://${host}/w/index.php?title=${encodeURIComponent(page)}&action=raw`;
}
