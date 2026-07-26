import { test, expect } from "@playwright/test";
import { startGameAtSkill, submitMove, keypad } from "./helpers";

test("recovers after an initial Stockfish load failure", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/engine/stockfish.js", (route) => {
    requestCount++;
    if (requestCount === 1) return route.fulfill({ status: 500, body: "boom" });
    return route.continue();
  });

  await page.goto("/");

  const retryButton = page.getByRole("button", { name: /Engine failed — Retry/ });
  await expect(retryButton).toBeVisible({ timeout: 20_000 });
  await retryButton.click();

  const startButton = page.getByRole("button", { name: /New Game/ });
  await expect(startButton).toBeVisible({ timeout: 20_000 });

  // New Game must actually work after a successful retry.
  await startButton.click();
  await expect(keypad(page)).toBeVisible();
  await submitMove(page, "e4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4/);
});

test("resign discards any in-flight engine reply", async ({ page }) => {
  await startGameAtSkill(page, "Full Strength");
  await submitMove(page, "e4");
  await expect(page.getByText("Stockfish thinking...")).toBeVisible({ timeout: 3000 });

  await page.getByRole("button", { name: /Resign/ }).click();
  await expect(page.getByText("You resigned.").first()).toBeVisible();

  // Give any in-flight deep search time to finish — its reply must never land.
  await page.waitForTimeout(4000);
  await expect(page.getByText(/^Black: /)).toHaveCount(0);
});

test("starting a new game while the engine is thinking restarts it safely", async ({ page }) => {
  await startGameAtSkill(page, "Full Strength");
  await submitMove(page, "e4");
  await expect(page.getByText("Stockfish thinking...")).toBeVisible({ timeout: 3000 });

  await page.getByRole("button", { name: /New Game/ }).click();

  await expect(page.getByText("No moves yet")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/^Black: /)).toHaveCount(0);

  // The restarted engine must still work correctly.
  await submitMove(page, "d4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. d4/);
});
