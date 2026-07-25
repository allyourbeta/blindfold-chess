import { test, expect } from "@playwright/test";
import { startStandardGame } from "./helpers";

test("play screen is usable one-handed at iPhone width", async ({ page }) => {
  await startStandardGame(page);

  // No horizontal scroll — the app shell must fit the viewport exactly.
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  // The move input and submit button must be visible and reachable without
  // being covered, and every touch target must meet the 44px minimum.
  const moveInput = page.getByLabel("Your move");
  await expect(moveInput).toBeVisible();
  const inputBox = await moveInput.boundingBox();
  expect(inputBox?.height).toBeGreaterThanOrEqual(44);
  if (viewport) expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(viewport.height);

  const submitButton = page.getByRole("button", { name: "Submit move" });
  const submitBox = await submitButton.boundingBox();
  expect(submitBox?.height).toBeGreaterThanOrEqual(44);

  const peekButton = page.getByLabel("Peek at the board");
  const peekBox = await peekButton.boundingBox();
  expect(peekBox?.height).toBeGreaterThanOrEqual(44);
  expect(peekBox?.width).toBeGreaterThanOrEqual(44);
});
