import { expect, test } from "@playwright/test";
import { waitForEngineReady, openApp } from "./helpers";

test("home screen prioritizes starting a game and progressively reveals details", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);

  await expect(page.getByRole("heading", { name: "Mind's Eye" })).toBeVisible();
  await expect(page.getByText("Ultimate brain visualization workout.")).toBeVisible();
  await expect(page.getByText("No chessboard? No problem!")).toBeVisible();
  await expect(page.locator('img[src="/icons/icon-512.png"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change settings" })).toBeVisible();

  // Detailed controls and the notation guide should not compete with the main
  // action until the player asks for them.
  await expect(page.getByRole("button", { name: "Full Strength", exact: true })).toHaveCount(0);
  await expect(page.getByText("Tap moves on the keypad")).toHaveCount(0);

  await page.getByRole("button", { name: "Change settings" }).click();
  await expect(page.getByRole("button", { name: "Full Strength", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByText("Tap moves on the keypad")).toBeVisible();
  await expect(page.getByRole("button", { name: "Full Strength", exact: true })).toHaveCount(0);
});
