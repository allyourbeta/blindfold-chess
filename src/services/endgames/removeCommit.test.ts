import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { verifyPassword, handleRemove, type GitHubClient } from "../../../api/_lib/removeCommit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, "fixtures/removeApi");

const SOURCES_PATH = "scripts/endgames/sources.json";
const CODES_PATH = "scripts/endgames/codes.json";
const CATALOG_PATH = "src/data/endgames.json";

function fixtureContent(path_: string): string {
  const name = path_.split("/").pop()!;
  return readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

interface FakeClientOptions {
  /** One sha per call to getRef -- the last one repeats once exhausted. */
  refShas?: string[];
  /** One result per call to updateRef -- the last one repeats once exhausted. */
  updateRefResults?: { ok: boolean }[];
}

interface FakeClientCalls {
  getRef: number;
  getFile: string[];
  createBlob: string[];
  createTree: { baseTreeSha: string; items: { path: string; sha: string }[] }[];
  createCommit: { message: string; treeSha: string; parentSha: string }[];
  updateRef: string[];
}

function makeFakeClient(opts: FakeClientOptions = {}) {
  const refShas = opts.refShas ?? ["parent-1"];
  const updateRefResults = opts.updateRefResults ?? [{ ok: true }];
  const calls: FakeClientCalls = {
    getRef: 0,
    getFile: [],
    createBlob: [],
    createTree: [],
    createCommit: [],
    updateRef: [],
  };
  let blobCounter = 0;
  let treeCounter = 0;
  let commitCounter = 0;
  const blobContents = new Map<string, string>();

  const client: GitHubClient = {
    async getRef() {
      const sha = refShas[Math.min(calls.getRef, refShas.length - 1)];
      calls.getRef++;
      return { sha };
    },
    async getFile(filePath: string) {
      calls.getFile.push(filePath);
      return fixtureContent(filePath);
    },
    async createBlob(content: string) {
      const sha = `blob-${++blobCounter}`;
      blobContents.set(sha, content);
      calls.createBlob.push(content);
      return { sha };
    },
    async createTree(baseTreeSha: string, items: { path: string; sha: string }[]) {
      const sha = `tree-${++treeCounter}`;
      calls.createTree.push({ baseTreeSha, items });
      return { sha };
    },
    async createCommit(message: string, treeSha: string, parentSha: string) {
      const sha = `commit-${++commitCounter}`;
      calls.createCommit.push({ message, treeSha, parentSha });
      return { sha };
    },
    async updateRef(commitSha: string) {
      calls.updateRef.push(commitSha);
      const result = updateRefResults[Math.min(calls.updateRef.length - 1, updateRefResults.length - 1)];
      return result;
    },
  };

  return { client, calls, blobContents };
}

describe("verifyPassword", () => {
  it("accepts a matching password", () => {
    expect(verifyPassword("hunter2", "hunter2")).toBe(true);
  });

  it("rejects a mismatched password", () => {
    expect(verifyPassword("wrong", "hunter2")).toBe(false);
  });

  it("rejects when nothing was provided", () => {
    expect(verifyPassword(undefined, "hunter2")).toBe(false);
  });

  it("rejects when nothing is configured", () => {
    expect(verifyPassword("hunter2", undefined)).toBe(false);
  });
});

describe("handleRemove", () => {
  it("wrong password: 401, and no GitHub writes", async () => {
    const { client, calls } = makeFakeClient();
    const result = await handleRemove({ client, code: "E275", password: "wrong", expectedPassword: "hunter2" });

    expect(result.status).toBe(401);
    expect(calls.createBlob).toHaveLength(0);
    expect(calls.createCommit).toHaveLength(0);
    expect(calls.updateRef).toHaveLength(0);
  });

  it("unknown code: 404", async () => {
    const { client } = makeFakeClient();
    const result = await handleRemove({ client, code: "E999", password: "hunter2", expectedPassword: "hunter2" });

    expect(result.status).toBe(404);
  });

  it("success: writes one commit with all three files changed correctly", async () => {
    const { client, calls, blobContents } = makeFakeClient();
    const result = await handleRemove({ client, code: "E275", password: "hunter2", expectedPassword: "hunter2" });

    expect(result.status).toBe(200);
    expect(calls.createCommit).toHaveLength(1);
    expect(calls.createCommit[0].message).toContain("E275");
    expect(calls.updateRef).toHaveLength(1);

    const tree = calls.createTree[0];
    expect(tree.items.map((i) => i.path).sort()).toEqual([CATALOG_PATH, CODES_PATH, SOURCES_PATH].sort());

    const bySha = new Map(tree.items.map((i) => [i.path, i.sha]));
    const nextSources = JSON.parse(blobContents.get(bySha.get(SOURCES_PATH)!)!);
    const nextCodes = JSON.parse(blobContents.get(bySha.get(CODES_PATH)!)!);
    const nextCatalog = JSON.parse(blobContents.get(bySha.get(CATALOG_PATH)!)!);

    expect(nextSources.some((e: { code: string }) => e.code === "E275")).toBe(false);
    expect(nextCodes.retired).toContain("E275");
    expect(nextCatalog.some((e: { code: string }) => e.code === "E275")).toBe(false);

    // The other fixture entries are untouched.
    const originalSources = JSON.parse(fixtureContent(SOURCES_PATH));
    expect(nextSources).toHaveLength(originalSources.length - 1);
  });

  it("one retry on a ref conflict", async () => {
    const { client, calls } = makeFakeClient({
      refShas: ["parent-1", "parent-2"],
      updateRefResults: [{ ok: false }, { ok: true }],
    });
    const result = await handleRemove({ client, code: "E275", password: "hunter2", expectedPassword: "hunter2" });

    expect(result.status).toBe(200);
    expect(calls.getRef).toBe(2);
    expect(calls.createCommit).toHaveLength(2);
    expect(calls.createCommit[1].parentSha).toBe("parent-2");
    expect(calls.updateRef).toHaveLength(2);
  });

  it("gives up after one failed retry", async () => {
    const { client, calls } = makeFakeClient({
      refShas: ["parent-1", "parent-2"],
      updateRefResults: [{ ok: false }, { ok: false }],
    });
    const result = await handleRemove({ client, code: "E275", password: "hunter2", expectedPassword: "hunter2" });

    expect(result.status).toBe(409);
    expect(calls.updateRef).toHaveLength(2);
  });
});
