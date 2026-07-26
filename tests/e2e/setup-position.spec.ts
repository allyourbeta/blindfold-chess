import { test, expect } from "@playwright/test";
import { waitForEngineReady, keypad } from "./helpers";

test("custom-position castling-right sanitation", async ({ page }) => {
  await page.goto("/");
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Set Up a Position/ }).click();

  // Remove White's h1 rook — its kingside castling right becomes impossible
  // even though the checkbox is left checked.
  await page.getByLabel("square h1").click();

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await page.getByRole("button", { name: /FEN/ }).click();
  const fenMessage = page.locator("text=/^\\S+ w /");
  await expect(fenMessage).toBeVisible();
  const fen = (await fenMessage.textContent()) ?? "";
  const castlingField = fen.split(" ")[2];

  expect(castlingField).not.toContain("K"); // sanitized away — no h1 rook
  expect(castlingField).toContain("Q"); // untouched right still present
});

test("importing a FEN preserves side-to-move, en passant, and move counters", async ({ page }) => {
  await page.goto("/");
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Set Up a Position/ }).click();

  const importedFen = "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3";
  await page.getByPlaceholder("Paste FEN string...").fill(importedFen);
  await page.getByRole("button", { name: "Load" }).click();

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await page.getByRole("button", { name: /FEN/ }).click();
  await expect(page.getByText(importedFen)).toBeVisible();
});
