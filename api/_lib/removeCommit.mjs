// SPEC_pos_page_and_remove.md Part 3 -- pure logic for removing a catalog
// entry via the GitHub Git Data API (blobs -> tree -> commit -> ref
// update), plus the password check shared by verify.ts and remove.ts.
// Takes a small GitHubClient interface rather than talking to GitHub
// itself, so it's unit-testable with a fake client and fixture files --
// api/positions/remove.ts supplies the real client built from env vars.
import { timingSafeEqual } from "node:crypto";
import { deleteEntry } from "../../scripts/endgames/positions.mjs";

const SOURCES_PATH = "scripts/endgames/sources.json";
const CODES_PATH = "scripts/endgames/codes.json";
const CATALOG_PATH = "src/data/endgames.json";

/** Constant-time string compare. False whenever either side is missing. */
export function verifyPassword(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || expected.length === 0) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function buildAndCommit(client, code) {
  const ref = await client.getRef();
  const parentSha = ref.sha;

  const [sourcesRaw, codesRaw, catalogRaw] = await Promise.all([
    client.getFile(SOURCES_PATH, parentSha),
    client.getFile(CODES_PATH, parentSha),
    client.getFile(CATALOG_PATH, parentSha),
  ]);

  const manifest = JSON.parse(sourcesRaw);
  const codes = JSON.parse(codesRaw);
  const catalog = JSON.parse(catalogRaw);

  if (!manifest.some((entry) => entry.code === code)) {
    return { status: 404, body: { error: `no entry with code ${code}` } };
  }

  const { manifest: nextManifest, codes: nextCodes } = deleteEntry(manifest, codes, code);
  const nextCatalog = catalog.filter((entry) => entry.code !== code);

  const files = [
    { path: SOURCES_PATH, content: `${JSON.stringify(nextManifest, null, 2)}\n` },
    { path: CODES_PATH, content: `${JSON.stringify(nextCodes, null, 2)}\n` },
    { path: CATALOG_PATH, content: `${JSON.stringify(nextCatalog, null, 2)}\n` },
  ];

  const items = [];
  for (const file of files) {
    const blob = await client.createBlob(file.content);
    items.push({ path: file.path, sha: blob.sha });
  }
  const tree = await client.createTree(parentSha, items);
  const commit = await client.createCommit(`Endgames: delete ${code} (from app)`, tree.sha, parentSha);
  const updated = await client.updateRef(commit.sha);

  if (!updated.ok) return { status: "conflict" };
  return { status: 200, body: { code } };
}

/**
 * Checks the password, then removes `code` -- retrying the commit once on
 * a ref conflict (decision: a phone removal and a laptop add racing each
 * other should never need a human to intervene). `expectedPassword` must
 * already be known non-empty; missing-env handling is api/positions's job.
 */
export async function handleRemove({ client, code, password, expectedPassword }) {
  if (!verifyPassword(password, expectedPassword)) {
    return { status: 401, body: { error: "wrong password" } };
  }
  if (typeof code !== "string" || code.length === 0) {
    return { status: 400, body: { error: "code required" } };
  }

  let result = await buildAndCommit(client, code);
  if (result.status === "conflict") {
    result = await buildAndCommit(client, code);
  }
  if (result.status === "conflict") {
    return { status: 409, body: { error: "could not update main after a retry" } };
  }
  return result;
}
