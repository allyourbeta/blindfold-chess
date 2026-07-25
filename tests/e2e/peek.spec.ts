import { test, expect } from "@playwright/test";
import { startStandardGame } from "./helpers";

const SQUARE_SELECTOR = '[class*="bg-sq-"]';

test("peek reveals the board and hides after three seconds", async ({ page }) => {
  await startStandardGame(page);

  await expect(page.locator(SQUARE_SELECTOR)).toHaveCount(0);
  await page.getByLabel("Peek at the board").click();
  await expect(page.locator(SQUARE_SELECTOR)).toHaveCount(64);

  await page.waitForTimeout(2500);
  await expect(page.locator(SQUARE_SELECTOR)).toHaveCount(64); // still visible before 3s

  await page.waitForTimeout(800); // now past the 3s window
  await expect(page.locator(SQUARE_SELECTOR)).toHaveCount(0);
});

test("one continuous hold counts as a single peek", async ({ page }) => {
  await startStandardGame(page);
  const peekButton = page.getByLabel("Peek at the board");

  await peekButton.click();
  await peekButton.click();
  await peekButton.click();
  await expect(page.getByText("Peeks: 1")).toBeVisible();

  await page.waitForTimeout(3200);
  await expect(page.locator(SQUARE_SELECTOR)).toHaveCount(0);

  await peekButton.click();
  await expect(page.getByText("Peeks: 2")).toBeVisible();
});
