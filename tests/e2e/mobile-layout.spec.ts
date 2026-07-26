import { test, expect } from "@playwright/test";
import { startStandardGame, keypad } from "./helpers";

test("play screen is usable one-handed at iPhone width", async ({ page }) => {
  await startStandardGame(page);

  // No horizontal scroll — the app shell must fit the viewport exactly.
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  // The keypad is the primary control now — no text input, no mic pad —
  // and it must be fully visible and reachable, every key meeting the 44px
  // minimum touch target.
  const pad = keypad(page);
  await expect(pad).toBeVisible();
  const padBox = await pad.boundingBox();
  if (viewport) expect(padBox!.y + padBox!.height).toBeLessThanOrEqual(viewport.height);

  await expect(page.getByLabel("Your move")).toHaveCount(0);
  await expect(page.getByLabel(/Start listening|Stop listening/)).toHaveCount(0);

  const knightKey = pad.getByRole("button", { name: "Knight" });
  const knightBox = await knightKey.boundingBox();
  expect(knightBox?.height).toBeGreaterThanOrEqual(44);

  const fileKey = pad.getByRole("button", { name: "e", exact: true });
  const fileBox = await fileKey.boundingBox();
  expect(fileBox?.height).toBeGreaterThanOrEqual(44);

  const peekButton = page.getByLabel("Peek at the board");
  const peekBox = await peekButton.boundingBox();
  expect(peekBox?.height).toBeGreaterThanOrEqual(44);
  expect(peekBox?.width).toBeGreaterThanOrEqual(44);
});
