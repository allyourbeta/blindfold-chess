import { test, expect } from "@playwright/test";
import { startStandardGame, submitMove } from "./helpers";

test("normal game start, player move, engine reply", async ({ page }) => {
  await startStandardGame(page);

  await expect(page.getByText(/Move 1 · White to play/)).toBeVisible();
  await submitMove(page, "e4");

  await expect(page.getByText("White: e4")).toBeVisible();
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4/, { timeout: 2000 });

  // Engine should reply with a second half-move within the pair.
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4 \S+/, { timeout: 15_000 });
  await expect(page.getByText(/Move 2 ·/)).toBeVisible();
});

test("takeback restores the previous position", async ({ page }) => {
  await startStandardGame(page);
  await submitMove(page, "e4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4 \S+/, { timeout: 15_000 });

  await page.getByRole("button", { name: /Takeback/ }).click();

  await expect(page.getByText("No moves yet")).toBeVisible();
  await expect(page.getByText(/Move 1 · White to play/)).toBeVisible();

  // The position is genuinely playable again, not just visually reset.
  await submitMove(page, "d4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. d4/);
});

test("illegal move is rejected without changing the position", async ({ page }) => {
  await startStandardGame(page);
  await submitMove(page, "e5"); // illegal for White's first move
  await expect(page.getByText(/Illegal or unrecognized move/)).toBeVisible();
  await expect(page.getByText("No moves yet")).toBeVisible();
});
