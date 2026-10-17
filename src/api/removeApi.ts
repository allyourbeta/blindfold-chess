/**
 * The app's own backend (api/positions/verify.ts, api/positions/remove.ts
 * -- SPEC_pos_page_and_remove.md Part 3). Only place that calls them.
 */

export async function verifyCreatorPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/positions/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${password}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface RemoveResult {
  ok: boolean;
  error?: string;
}

export async function removePosition(code: string, password: string): Promise<RemoveResult> {
  try {
    const res = await fetch("/api/positions/remove", {
      method: "POST",
      headers: { Authorization: `Bearer ${password}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body: { error?: string } = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error ?? `Request failed (${res.status})` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Try again." };
  }
}
