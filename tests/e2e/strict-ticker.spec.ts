import { test, expect } from "@playwright/test";
import { keypad, waitForEngineReady, tapKeypadKey } from "./helpers";

// These tests deliberately use a bare goto: no seeded settings, so the app
// runs on its production defaults — ticker hidden, keypad strict.

async function startDefaultGame(page: import("@playwright/test").Page) {
  await page.goto("/");
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();
}

test("ticker defaults to hidden and toggles by tapping the row", async ({ page }) => {
  await startDefaultGame(page);
  await expect(page.getByText("Moves hidden")).toBeVisible();
  await expect(page.getByText("No moves yet")).toHaveCount(0);

  await page.getByRole("button", { name: /Move list hidden/ }).click();
  await expect(page.getByText("No moves yet")).toBeVisible();

  await page.getByRole("button", { name: /Move list — tap to hide/ }).click();
  await expect(page.getByText("Moves hidden")).toBeVisible();
});

test("strict keypad: every key lit at the start, no early resolution, full entry plays", async ({ page }) => {
  await startDefaultGame(page);

  // Rooks have no legal move at the start; strict must light the key anyway.
  await expect(keypad(page).getByRole("button", { name: "Rook" })).toBeEnabled();
  // Piece-first: square keys stay dead until a piece starts the entry.
  await expect(keypad(page).getByRole("button", { name: "a1", exact: true })).toBeDisabled();

  await tapKeypadKey(page, "Knight");
  await expect(keypad(page).getByRole("button", { name: "a1", exact: true })).toBeEnabled();
  await tapKeypadKey(page, "f");
  // No mode completes a partial entry — the rank must be stated.
  await expect(page.getByText("Moves hidden")).toBeVisible();

  await tapKeypadKey(page, "3");
  await page.getByRole("button", { name: /Move list hidden/ }).click();
  await expect(page.getByText(/1\. Nf3/)).toBeVisible();
});

test("strict keypad: a fully stated illegal move is rejected and the position doesn't change", async ({ page }) => {
  await startDefaultGame(page);

  await tapKeypadKey(page, "Knight");
  await tapKeypadKey(page, "f");
  await tapKeypadKey(page, "6");

  // Nf6 is Black's move — the entry submits and the app rejects it.
  await expect(page.getByText(/Illegal or unrecognized move/)).toBeVisible();
  await page.getByRole("button", { name: /Move list hidden/ }).click();
  await expect(page.getByText("No moves yet")).toBeVisible();
});
