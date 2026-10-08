import { test, expect } from "@playwright/test";
import { startStandardGame, submitMove, keypad, tapKeypadKey } from "./helpers";

test("normal game start, player move, engine reply", async ({ page }) => {
  await startStandardGame(page);

  await expect(page.getByText(/Your move ·/)).toBeVisible();
  await submitMove(page, "e4");

  await expect(page.getByText("White: e4")).toBeVisible();
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4/, { timeout: 2000 });

  // Engine should reply with a second half-move within the pair.
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4 \S+/, { timeout: 15_000 });
  // After the engine's reply it's the player's turn again.
  await expect(page.getByText(/Your move ·/)).toBeVisible();
});

test("takeback restores the previous position", async ({ page }) => {
  await startStandardGame(page);
  await submitMove(page, "e4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4 \S+/, { timeout: 15_000 });

  await page.getByRole("button", { name: /Takeback/ }).click();

  await expect(page.getByText("No moves yet")).toBeVisible();
  await expect(page.getByText(/Your move ·/)).toBeVisible();

  // The position is genuinely playable again, not just visually reset.
  await submitMove(page, "d4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. d4/);
});

test("an illegal destination can't be entered — the keypad disables it — and the position doesn't change", async ({
  page,
}) => {
  await startStandardGame(page);
  // After "e", neither reading of the e5 dual key is a legal move — the
  // e-pawn can't reach rank 5 and can't capture on its own file — so the
  // key must be disabled, not merely refused after the fact.
  await tapKeypadKey(page, "e");
  await expect(keypad(page).getByRole("button", { name: "e5", exact: true })).toBeDisabled();
  await expect(page.getByText("No moves yet")).toBeVisible();

  // Undo the pending "e" tap before playing a real move, so the entry starts fresh.
  await tapKeypadKey(page, "Undo last entry");
  await submitMove(page, "e4");
  await expect(page.getByText("White: e4")).toBeVisible();
});

test("Resign asks for confirmation first — Cancel and Escape both keep the game going", async ({ page }) => {
  await startStandardGame(page);
  await submitMove(page, "e4");

  await page.getByRole("button", { name: /Resign/ }).click();
  const confirm = page.getByRole("dialog").filter({ hasText: "Resign this game?" });
  await expect(confirm).toBeVisible();

  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  // The game is still on: the move entered before Resign is still there, and
  // the keypad is still live.
  await expect(page.getByText("White: e4")).toBeVisible();
  await expect(page.getByRole("button", { name: /Takeback/ })).toBeEnabled();

  await page.getByRole("button", { name: /Resign/ }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "Resign this game?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog").filter({ hasText: "Resign this game?" })).toBeHidden();
  await expect(page.getByRole("button", { name: /Takeback/ })).toBeEnabled();
});

test("resign-confirm.png", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startStandardGame(page);
  await page.getByRole("button", { name: /Resign/ }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "Resign this game?" })).toBeVisible();
  await page.screenshot({ path: "test-results/resign-confirm.png" });
});

test("Resign, confirmed, ends the game", async ({ page }) => {
  await startStandardGame(page);

  await page.getByRole("button", { name: /Resign/ }).click();
  const confirm = page.getByRole("dialog").filter({ hasText: "Resign this game?" });
  await confirm.getByRole("button", { name: "Resign", exact: true }).click();

  await expect(page.getByText("You resigned.").first()).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "New Game" })).toBeVisible();
});
