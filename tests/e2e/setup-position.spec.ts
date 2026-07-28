import { test, expect } from "@playwright/test";
import { waitForEngineReady, keypad, openApp, tapMoreAction } from "./helpers";

test("custom-position castling-right sanitation", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  // Remove White's h1 rook — its kingside castling right becomes impossible
  // even though the checkbox is left checked.
  await page.getByLabel("square h1").click();

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await tapMoreAction(page, /FEN/);
  const fenMessage = page.locator("text=/^\\S+ w /");
  await expect(fenMessage).toBeVisible();
  const fen = (await fenMessage.textContent()) ?? "";
  const castlingField = fen.split(" ")[2];

  expect(castlingField).not.toContain("K"); // sanitized away — no h1 rook
  expect(castlingField).toContain("Q"); // untouched right still present
});

test("importing a FEN preserves side-to-move, en passant, and move counters", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  const importedFen = "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3";
  await page.getByPlaceholder("Paste FEN string...").fill(importedFen);
  await page.getByRole("button", { name: "Load" }).click();

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await tapMoreAction(page, /FEN/);
  await expect(page.getByText(importedFen)).toBeVisible();
});

test("the setup board keeps its size after Clear Board", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  const board = page.locator("[data-testid='setup-board'], .grid-cols-8").first();
  const before = await page.getByRole("button", { name: /Clear Board/ }).boundingBox();
  expect(before).not.toBeNull();

  // Squares are percentage-width, so the board needs a definite width of its
  // own. When it didn't have one, an empty board had no contents to imply a
  // size and collapsed to a few dozen pixels.
  //
  // Falsifier: this goes red if the board is narrower after clearing than a
  // usable board can be, or if clearing changes its width at all.
  const widthWithPieces = (await boardWidth(page)) ?? 0;
  expect(widthWithPieces).toBeGreaterThan(200);

  await page.getByRole("button", { name: /Clear Board/ }).click();

  const widthWhenEmpty = (await boardWidth(page)) ?? 0;
  expect(widthWhenEmpty).toBeGreaterThan(200);
  expect(Math.abs(widthWhenEmpty - widthWithPieces)).toBeLessThan(2);
  void board;
});

async function boardWidth(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const label = Array.from(document.querySelectorAll("div")).find(
      (d) => d.textContent?.trim() === "a" && d.className.includes("w-[12.5%]"),
    );
    const row = label?.parentElement?.parentElement;
    return row ? row.getBoundingClientRect().width : null;
  });
}
