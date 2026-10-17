// SPEC_pos_page_and_remove.md Part 3 -- POST {code} with the same
// `Authorization: Bearer <password>` header as verify.ts. On a valid
// password, removes `code` from sources.json/codes.json/endgames.json in
// one commit to `main` via the GitHub Git Data API. Unknown code -> 404.
// Missing env -> 500 with a plain message (never logs the password or
// token). See api/_lib/removeCommit.mjs for the actual commit logic and
// its unit tests.
import { handleRemove, type GitHubClient } from "../_lib/removeCommit.mjs";

function bearerToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.startsWith("Bearer ") ? value.slice(7) : undefined;
}

function githubClient(token: string, repo: string): GitHubClient {
  const base = `https://api.github.com/repos/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  async function call(path: string, init?: RequestInit): Promise<any> {
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
    if (!res.ok) throw new Error(`GitHub API ${path} failed: HTTP ${res.status}`);
    return res.json();
  }

  return {
    async getRef() {
      const data = await call("/git/ref/heads/main");
      return { sha: data.object.sha };
    },
    async getFile(path) {
      const data = await call(`/contents/${path}?ref=main`);
      return Buffer.from(data.content, "base64").toString("utf8");
    },
    async createBlob(content) {
      const data = await call("/git/blobs", {
        method: "POST",
        body: JSON.stringify({ content, encoding: "utf-8" }),
      });
      return { sha: data.sha };
    },
    async createTree(baseTreeSha, items) {
      const data = await call("/git/trees", {
        method: "POST",
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: items.map((item) => ({ path: item.path, mode: "100644", type: "blob", sha: item.sha })),
        }),
      });
      return { sha: data.sha };
    },
    async createCommit(message, treeSha, parentSha) {
      const data = await call("/git/commits", {
        method: "POST",
        body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
      });
      return { sha: data.sha };
    },
    async updateRef(commitSha) {
      const res = await fetch(`${base}/git/refs/heads/main`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ sha: commitSha, force: false }),
      });
      return { ok: res.ok };
    },
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const expectedPassword = process.env.POS_PASSWORD;
  if (!token || !repo || !expectedPassword) {
    return res.status(500).json({ error: "server is not configured for removal" });
  }

  const password = bearerToken(req.headers.authorization);
  const code = typeof req.body?.code === "string" ? req.body.code : undefined;

  try {
    const result = await handleRemove({ client: githubClient(token, repo), code, password, expectedPassword });
    return res.status(result.status).json(result.body ?? {});
  } catch (err) {
    return res.status(500).json({ error: "removal failed" });
  }
}
