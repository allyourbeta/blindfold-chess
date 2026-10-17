export interface GitHubClient {
  getRef(): Promise<{ sha: string }>;
  getFile(path: string, ref: string): Promise<string>;
  createBlob(content: string): Promise<{ sha: string }>;
  createTree(baseTreeSha: string, items: { path: string; sha: string }[]): Promise<{ sha: string }>;
  createCommit(message: string, treeSha: string, parentSha: string): Promise<{ sha: string }>;
  updateRef(commitSha: string): Promise<{ ok: boolean }>;
}

export declare function verifyPassword(provided: string | undefined, expected: string | undefined): boolean;

export interface RemoveResult {
  status: number;
  body?: { error?: string; code?: string };
}

export declare function handleRemove(args: {
  client: GitHubClient;
  code: string | undefined;
  password: string | undefined;
  expectedPassword: string;
}): Promise<RemoveResult>;
