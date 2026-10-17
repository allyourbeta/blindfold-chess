// SPEC_pos_page_and_remove.md Part 3 -- POST with `Authorization: Bearer
// <password>`. 200 if it matches POS_PASSWORD (constant-time compare),
// else 401 -- including when POS_PASSWORD itself is unset.
//
// Vercel's Node runtime hands this `req`/`res` (with `.status()`/`.json()`
// helpers already attached) at runtime without needing `@vercel/node`
// installed; this file sits outside tsconfig.app's "src" include, so it is
// never part of `npm run typecheck`/`build` -- only `vercel build` compiles
// it (Part 3.5).
import { verifyPassword } from "../_lib/removeCommit.mjs";

function bearerToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.startsWith("Bearer ") ? value.slice(7) : undefined;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const provided = bearerToken(req.headers.authorization);
  const expected = process.env.POS_PASSWORD;

  if (!verifyPassword(provided, expected)) {
    return res.status(401).json({ error: "wrong password" });
  }
  return res.status(200).json({ ok: true });
}
