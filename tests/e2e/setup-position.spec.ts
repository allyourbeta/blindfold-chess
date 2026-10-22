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
  const before = await page.getByRole("button", { name: "Clear", exact: true }).boundingBox();
  expect(before).not.toBeNull();

  // Squares are percentage-width, so the board needs a definite width of its
  // own. When it didn't have one, an empty board had no contents to imply a
  // size and collapsed to a few dozen pixels.
  //
  // Falsifier: this goes red if the board is narrower after clearing than a
  // usable board can be, or if clearing changes its width at all.
  const widthWithPieces = (await boardWidth(page)) ?? 0;
  expect(widthWithPieces).toBeGreaterThan(200);

  await page.getByRole("button", { name: "Clear", exact: true }).click();

  const widthWhenEmpty = (await boardWidth(page)) ?? 0;
  expect(widthWhenEmpty).toBeGreaterThan(200);
  expect(Math.abs(widthWhenEmpty - widthWithPieces)).toBeLessThan(2);
  void board;
});

async function boardWidth(page: import("@playwright/test").Page) {
  const box = await page.getByTestId("board").first().boundingBox();
  return box?.width ?? null;
}

test("castling toggle turns a right off", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  const oooButton = page.getByRole("button", { name: "White O-O-O" });
  await expect(oooButton).toHaveAttribute("aria-pressed", "true");
  await oooButton.click();
  await expect(oooButton).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await tapMoreAction(page, /FEN/);
  const fenMessage = page.locator("text=/^\\S+ w /");
  await expect(fenMessage).toBeVisible();
  const fen = (await fenMessage.textContent()) ?? "";
  const castlingField = fen.split(" ")[2];

  expect(castlingField).toContain("K"); // untouched right still present
  expect(castlingField).not.toContain("Q"); // toggled off
});

test("compact layout", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone", "iphone-only layout check");
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  await expect(page.getByText(/Click a piece/)).toHaveCount(0);

  const resetBox = await page.getByRole("button", { name: "Reset", exact: true }).boundingBox();
  const clearBox = await page.getByRole("button", { name: "Clear", exact: true }).boundingBox();
  const playBox = await page.getByRole("button", { name: "Play Blindfold" }).boundingBox();
  expect(resetBox).not.toBeNull();
  expect(clearBox).not.toBeNull();
  expect(playBox).not.toBeNull();
  expect(Math.abs(resetBox!.y - clearBox!.y)).toBeLessThan(2);
  expect(Math.abs(resetBox!.y - playBox!.y)).toBeLessThan(2);

  const rotateBox = await page.getByRole("button", { name: "Rotate the board 180 degrees" }).boundingBox();
  const board = await page.getByTestId("board").first().boundingBox();
  expect(rotateBox).not.toBeNull();
  expect(board).not.toBeNull();
  expect(rotateBox!.y).toBeLessThan(board!.y);
});

test("header rotate flips the board", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  const a1Before = await page.getByLabel("square a1").boundingBox();
  expect(a1Before).not.toBeNull();

  await page.getByRole("button", { name: "Rotate the board 180 degrees" }).click();

  const board = await page.getByTestId("board").first().boundingBox();
  const a1After = await page.getByLabel("square a1").boundingBox();
  expect(board).not.toBeNull();
  expect(a1After).not.toBeNull();
  expect(a1After!.y).toBeLessThan(board!.y + board!.height / 2);
});
