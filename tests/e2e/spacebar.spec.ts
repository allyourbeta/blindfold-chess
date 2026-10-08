import { test, expect } from "@playwright/test";
import { openApp, waitForEngineReady, startStandardGame, keypad } from "./helpers";

const SQUARE_SELECTOR = '[class*="bg-sq-"]';

test("Space on the menu activates the focused button instead of peeking", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);

  const newGameButton = page.getByRole("button", { name: /New Game/ });
  await newGameButton.focus();
  await page.keyboard.press("Space");

  // The button's own action fired -- the game actually started.
  await expect(keypad(page)).toBeVisible();
});

test("Space on the play screen with nothing focused peeks at the board", async ({ page }) => {
  await startStandardGame(page);
  // Nothing on the play screen should start out focused, but make sure --
  // clicking neutral background matches what a real player's first tap does.
  await page.locator("body").click({ position: { x: 1, y: 1 } });

  await expect(page.locator(SQUARE_SELECTOR)).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.locator(SQUARE_SELECTOR)).toHaveCount(64);
});
