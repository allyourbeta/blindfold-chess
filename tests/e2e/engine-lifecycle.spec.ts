import { test, expect } from "@playwright/test";
import { startStandardGame, submitMove, keypad, openApp, waitForEngineReady, throttleCpu, tapMoreAction } from "./helpers";

test("recovers after an initial Maia model load failure", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/maia_kdd_1900.onnx", (route) => {
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

/**
 * These three tests exercise resign / New Game against a request that may
 * still be in flight. Maia (unlike Stockfish) has no depth/skill dial to
 * force a slow, reliably-observable search, so `throttleCpu` is a
 * best-effort attempt to widen that window instead of a guarantee -- see
 * its doc comment. Either outcome (the request was genuinely aborted, or it
 * happened to finish first) is a PASS here: the property under test is "the
 * app recovers cleanly and never strands the player", which holds in both
 * cases. The narrower property "a stale reply never reaches onMove once
 * superseded" already has a deterministic, timing-independent test at
 * src/engine/engineManager.test.ts.
 */
test("resign always ends the game cleanly, whether or not Maia had already replied", async ({ page }) => {
  await startStandardGame(page);
  await throttleCpu(page, 20);
  await submitMove(page, "e4");
  await page.getByRole("button", { name: /Resign/ }).click();

  await expect(page.getByText("You resigned.").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/error/i)).toHaveCount(0);

  // Whatever was in flight must not still be running: give it time, then
  // confirm nothing shows up as "thinking" or produces a further message.
  await page.waitForTimeout(4000);
  await expect(page.getByText(/thinking/i)).toHaveCount(0);
});

test("starting a new game while Maia might still be replying restarts it safely", async ({ page }) => {
  await startStandardGame(page);
  await throttleCpu(page, 20);
  await submitMove(page, "e4");
  await tapMoreAction(page, /New Game/);

  await expect(page.getByText("No moves yet")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/error/i)).toHaveCount(0);

  // The restarted engine must still work correctly, at full speed.
  await throttleCpu(page, 1);
  await submitMove(page, "d4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. d4/);
});

test("resign then New Game recovers cleanly — a fresh move gets a sane reply, no error", async ({ page }) => {
  await startStandardGame(page);
  await throttleCpu(page, 20);
  await submitMove(page, "e4");
  await page.getByRole("button", { name: /Resign/ }).click();
  await expect(page.getByText("You resigned.").first()).toBeVisible({ timeout: 15_000 });

  await throttleCpu(page, 1);
  await page.getByRole("dialog").getByRole("button", { name: "Menu" }).click();
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
  await page.getByRole("button", { name: /set up a position/i }).click();

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
