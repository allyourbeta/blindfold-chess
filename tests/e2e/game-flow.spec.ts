import { test, expect } from "@playwright/test";
import { startStandardGame, submitMove, keypad, tapKeypadKey } from "./helpers";

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

test("an illegal destination can't be entered — the keypad disables it — and the position doesn't change", async ({
  page,
}) => {
  await startStandardGame(page);
  // White's first pawn move can't reach rank 5 — the key must be disabled,
  // not merely refused after the fact, so tapping it is not an option at all.
  await tapKeypadKey(page, "e");
  await expect(keypad(page).getByRole("button", { name: "5", exact: true })).toBeDisabled();
  await expect(page.getByText("No moves yet")).toBeVisible();

  // Undo the pending "e" tap before playing a real move, so the entry starts fresh.
  await tapKeypadKey(page, "Undo last entry");
  await submitMove(page, "e4");
  await expect(page.getByText("White: e4")).toBeVisible();
});
