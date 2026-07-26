import { expect, type Page } from "@playwright/test";

export async function waitForEngineReady(page: Page) {
  await expect(page.getByRole("button", { name: /New Game/ })).toBeVisible({
    timeout: 20_000,
  });
}

export function keypad(page: Page) {
  return page.getByRole("group", { name: "Move entry keypad" });
}

export async function startStandardGame(page: Page) {
  await page.goto("/");
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();
}

/** Selects a skill level by its label on the menu screen before starting — use "Full Strength" for tests that need a slow, reliably in-flight search. */
export async function startGameAtSkill(page: Page, skillLabel: string) {
  await page.goto("/");
  await waitForEngineReady(page);
  await page.getByRole("button", { name: "Change settings" }).click();
  await page.getByRole("button", { name: skillLabel, exact: true }).click();
  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();
}

const PIECE_NAME: Record<string, string> = { N: "Knight", B: "Bishop", R: "Rook", Q: "Queen", K: "King" };
const PROMOTION_NAME: Record<string, string> = { Q: "Queen", R: "Rook", B: "Bishop", N: "Knight" };

/**
 * Converts a SAN string into the keypad taps that produce it: piece (if
 * any), then destination file + rank — or, for a pawn capture, origin
 * file + destination file + destination rank. Captures/check/mate are
 * never tapped; SAN carries them automatically, so they're stripped here.
 */
function sanToTaps(san: string): { taps: string[]; promotion?: string } {
  let s = san.replace(/[+#]/g, "");

  let promotion: string | undefined;
  const eq = s.indexOf("=");
  if (eq !== -1) {
    promotion = PROMOTION_NAME[s[eq + 1]];
    s = s.slice(0, eq);
  }

  if (s === "O-O" || s === "O-O-O") return { taps: [s], promotion };

  const pieceMatch = s.match(/^[NBRQK]/);
  const taps: string[] = [];
  if (pieceMatch) {
    taps.push(PIECE_NAME[pieceMatch[0]]);
    s = s.slice(1);
  }
  s = s.replace("x", "");

  if (!pieceMatch && s.length === 3) {
    taps.push(s[0], s[1], s[2]); // pawn capture: origin file, dest file, dest rank
  } else {
    const dest = s.slice(-2);
    taps.push(dest[0], dest[1]);
  }

  return { taps, promotion };
}

export async function tapKeypadKey(page: Page, name: string) {
  await keypad(page).getByRole("button", { name, exact: true }).click();
}

/** Plays a move by tapping the keypad keys that produce it — see sanToTaps. */
export async function submitMove(page: Page, san: string) {
  const { taps, promotion } = sanToTaps(san);
  for (const tap of taps) await tapKeypadKey(page, tap);
  if (promotion) await tapKeypadKey(page, promotion);
}
