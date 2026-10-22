import { test, expect } from "@playwright/test";
import { openApp, waitForEngineReady, submitMove, keypad } from "./helpers";

test("switching to Stockfish plays a game, persists, and switching back to Maia works too", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);

  await page.getByRole("button", { name: /Opponent/ }).click();
  await page.getByRole("radio", { name: "Stockfish" }).click();
  await page.getByRole("button", { name: "Easy", exact: true }).click();

  await expect(page.getByRole("button", { name: /^Opponent/ })).toContainText("Stockfish");
  await expect(page.getByRole("button", { name: /^Level/ })).toContainText("Easy");

  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();

  await expect(page.getByText(/Your move · Stockfish · Easy/)).toBeVisible();

  await submitMove(page, "e4");
  await expect(page.getByText(/^Black: /)).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Opponent/ }).click();
  await expect(page.getByRole("radio", { name: "Stockfish" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Easy", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Switch back to Maia: Variance returns in place of Level, on the chip and in the panel.
  await page.getByRole("radio", { name: "Maia 1900" }).click();
  await expect(page.getByRole("button", { name: /^Variance/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Level/ })).toHaveCount(0);

  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();
  await expect(page.getByText(/Your move · Maia 1900/)).toBeVisible();
});
