import { test, expect } from "@playwright/test";
import { startStandardGame, waitForEngineReady, keypad, submitMove, tapKeypadKey } from "./helpers";

test("plays e4 by tapping e then 4", async ({ page }) => {
  await startStandardGame(page);
  await submitMove(page, "e4");
  await expect(page.getByText("White: e4")).toBeVisible();
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4/);
});

test("a knight ambiguity shows both SAN labels in the chooser, and tapping one plays it", async ({ page }) => {
  await page.goto("/");
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Set Up a Position/ }).click();

  // Knights on b3 and f3 both reach d2 — a genuine SAN disambiguation.
  await page.getByPlaceholder("Paste FEN string...").fill("4k3/8/8/8/8/1N3N2/8/4K3 w - - 0 1");
  await page.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await tapKeypadKey(page, "Knight");
  await tapKeypadKey(page, "d");
  await tapKeypadKey(page, "2");

  const nbd2 = keypad(page).getByRole("button", { name: "Nbd2", exact: true });
  const nfd2 = keypad(page).getByRole("button", { name: "Nfd2", exact: true });
  await expect(nbd2).toBeVisible();
  await expect(nfd2).toBeVisible();

  await nbd2.click();
  await expect(page.getByText("White: Nbd2")).toBeVisible();
});

test("disables rank keys that no legal move can reach", async ({ page }) => {
  await startStandardGame(page);
  await tapKeypadKey(page, "Knight");
  // No file has been chosen yet, so every rank is still unreachable.
  await expect(keypad(page).getByRole("button", { name: "5", exact: true })).toBeDisabled();
});

test("desktop: a physical keyboard drives the same state machine", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "keyboard-driven entry is a desktop scenario");
  await startStandardGame(page);
  await page.keyboard.press("e");
  await page.keyboard.press("4");
  await expect(page.getByText("White: e4")).toBeVisible();
});

test("mobile: the keypad renders and no text input or mic pad exists", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone", "checks the mobile viewport specifically");
  await startStandardGame(page);
  await expect(keypad(page)).toBeVisible();
  await expect(page.getByLabel("Your move")).toHaveCount(0);
  await expect(page.getByLabel(/Start listening|Stop listening/)).toHaveCount(0);
});
