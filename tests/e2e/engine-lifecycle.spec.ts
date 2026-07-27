import { test, expect } from "@playwright/test";
import { startGameAtSkill, submitMove, keypad, openApp, waitForEngineReady } from "./helpers";

test("recovers after an initial Stockfish load failure", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/engine/stockfish.js", (route) => {
    requestCount++;
    if (requestCount === 1) return route.fulfill({ status: 500, body: "boom" });
    return route.continue();
  });

  await openApp(page);

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

test("resign then New Game recovers cleanly — a fresh move gets a sane reply, no error", async ({ page }) => {
  // Full Strength (depth 18) reliably keeps a search in flight long enough
  // to resign against it — the same reason the other resign test uses it.
  await startGameAtSkill(page, "Full Strength");
  await submitMove(page, "e4");
  await expect(page.getByText("Stockfish thinking...")).toBeVisible({ timeout: 3000 });

  await page.getByRole("button", { name: /Resign/ }).click();
  await expect(page.getByText("You resigned.").first()).toBeVisible();

  // Back to the menu to drop to a fast skill level — otherwise the
  // follow-up move's engine reply could take as long as the abandoned
  // depth-18 search did, which isn't what this test is checking.
  await page.getByRole("dialog").getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Change settings" }).click();
  await page.getByRole("button", { name: "Club (~1500)", exact: true }).click();
  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(page.getByText("No moves yet")).toBeVisible({ timeout: 15_000 });

  await submitMove(page, "d4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. d4/);
  await expect(page.getByText(/^Black: /)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/error/i)).toHaveCount(0);
});

test("a checkmate set-up position ends the game immediately with an inert keypad", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Set Up a Position/ }).click();

  // Fool's Mate: White to move, already checkmated — no engine request is
  // possible or needed, and White (the default player color) has no move.
  const checkmateFen = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
  await page.getByPlaceholder("Paste FEN string...").fill(checkmateFen);
  await page.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Play Blindfold" }).click();

  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog").getByText(/Checkmate/)).toBeVisible();
  await expect(keypad(page).getByRole("button", { name: "Knight" })).toBeDisabled();
});
