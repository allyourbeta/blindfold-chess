import { test, expect, type Page } from "@playwright/test";
import { waitForEngineReady, keypad, openApp, tapMoreAction, startStandardGame, resignGame, PHONE_USABLE } from "./helpers";

/** K+B vs K on an otherwise-empty board, via the setup screen's piece palette. */
async function setUpInsufficientMaterial(page: Page) {
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByRole("button", { name: "white king", exact: true }).click();
  await page.getByLabel("square e1").click();
  await page.getByRole("button", { name: "white bishop", exact: true }).click();
  await page.getByLabel("square c1").click();
  await page.getByRole("button", { name: "black king", exact: true }).click();
  await page.getByLabel("square e8").click();
}

test("custom-position castling-right sanitation", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  // Remove White's h1 rook — its kingside castling right becomes impossible
  // even though the checkbox is left checked. One-tap replace means
  // removing a square's piece requires selecting that same piece first.
  await page.getByRole("button", { name: "white rook", exact: true }).click();
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

/** Piece letter (or null) at a square, read from a FEN placement field. */
function pieceAt(placement: string, square: string): string | null {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]);
  const row = placement.split("/")[8 - rank];
  let col = 0;
  for (const ch of row) {
    if ("12345678".includes(ch)) {
      col += Number(ch);
    } else {
      if (col === file) return ch;
      col++;
    }
  }
  return null;
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

  // SPEC_setup_header.md -- Flip moved off the header and onto the To-move
  // row, directly under the board. It's below the board now, not above it.
  const rotateBox = await page.getByRole("button", { name: "Rotate the board 180 degrees" }).boundingBox();
  const board = await page.getByTestId("board").first().boundingBox();
  expect(rotateBox).not.toBeNull();
  expect(board).not.toBeNull();
  expect(rotateBox!.y).toBeGreaterThan(board!.y + board!.height);
});

test("Reset/Clear/Play sit above the castling group, which sits above the FEN row", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  const buttonsTop = (await page.getByRole("button", { name: "Reset", exact: true }).boundingBox())?.y;
  const castlingTop = (await page.getByRole("button", { name: "White O-O", exact: true }).boundingBox())?.y;
  const fenTop = (await page.getByPlaceholder("Paste FEN string...").boundingBox())?.y;
  expect(buttonsTop).not.toBeUndefined();
  expect(castlingTop).not.toBeUndefined();
  expect(fenTop).not.toBeUndefined();
  expect(buttonsTop!).toBeLessThan(castlingTop!);
  expect(castlingTop!).toBeLessThan(fenTop!);
});

test("tapping a square replaces its piece with the selected one", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  // a1 starts with the white rook. Selecting the black bishop and tapping
  // a1 should REPLACE the rook with the bishop, not clear the square.
  await page.getByRole("button", { name: "black bishop", exact: true }).click();
  await page.getByLabel("square a1").click();

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await tapMoreAction(page, /FEN/);
  const fenMessage = page.locator("text=/^\\S+ w /");
  await expect(fenMessage).toBeVisible();
  const fen = (await fenMessage.textContent()) ?? "";
  const placement = fen.split(" ")[0];
  expect(pieceAt(placement, "a1")).toBe("b");
});

test("tapping a square holding the selected piece removes it", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  // a1 starts with the white rook. Selecting the white rook and tapping
  // the square that already holds it should remove it.
  await page.getByRole("button", { name: "white rook", exact: true }).click();
  await page.getByLabel("square a1").click();

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await tapMoreAction(page, /FEN/);
  const fenMessage = page.locator("text=/^\\S+ w /");
  await expect(fenMessage).toBeVisible();
  const fen = (await fenMessage.textContent()) ?? "";
  const placement = fen.split(" ")[0];
  expect(pieceAt(placement, "a1")).toBeNull();
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

test("game over after a set-up game: Edit position is the first button, and returns to the position as it was", async ({
  page,
}) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();
  await setUpInsufficientMaterial(page);

  await page.getByRole("button", { name: "Play Blindfold" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const buttonNames = await dialog.getByRole("button").allTextContents();
  expect(buttonNames[0]).toBe("Edit position");

  await dialog.getByRole("button", { name: "Edit position" }).click();

  await expect(page.getByRole("heading", { name: "Position Setup" })).toBeVisible();
  await expect(page.getByLabel("square e1").getByAltText("white king")).toBeVisible();
  await expect(page.getByLabel("square c1").getByAltText("white bishop")).toBeVisible();
  await expect(page.getByLabel("square e8").getByAltText("black king")).toBeVisible();
  await expect(page.getByRole("radio", { name: "White", exact: true })).toHaveAttribute("aria-checked", "true");
});

test("game over after a normal game: New Game is the first button, and there's no Edit position", async ({
  page,
}) => {
  await startStandardGame(page);
  await resignGame(page);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const buttonNames = await dialog.getByRole("button").allTextContents();
  expect(buttonNames[0]).toBe("New Game");
  await expect(dialog.getByRole("button", { name: "Edit position" })).toHaveCount(0);
});

// SPEC_setup_header.md -- designed header (back pill + centered title),
// Flip moved under the board, piece rows stretched to the board's width.
const HEADER_VIEWPORTS: Record<string, { width: number; height: number }> = {
  phoneUsable: PHONE_USABLE,
  w360: { width: 360, height: 740 },
};

for (const [name, viewport] of Object.entries(HEADER_VIEWPORTS)) {
  test.describe(`setup header redesign (${name})`, () => {
    test.use({ viewport });

    test("title is one line and centered in the header", async ({ page }) => {
      await openApp(page);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /set up a position/i }).click();

      const title = page.getByRole("heading", { name: "Position Setup" });
      const titleBox = await title.boundingBox();
      const lineHeight = await title.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
      expect(titleBox).not.toBeNull();
      expect(titleBox!.height).toBeLessThan(1.5 * lineHeight);

      const header = page.locator("header");
      const headerBox = await header.boundingBox();
      expect(headerBox).not.toBeNull();
      const titleCenterX = titleBox!.x + titleBox!.width / 2;
      const headerCenterX = headerBox!.x + headerBox!.width / 2;
      expect(Math.abs(titleCenterX - headerCenterX)).toBeLessThan(4);
    });

    test("the flip button sits below the board, sharing a row with the White/Black switch", async ({ page }) => {
      await openApp(page);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /set up a position/i }).click();

      const board = await page.getByTestId("board").first().boundingBox();
      const rotate = await page.getByRole("button", { name: "Rotate the board 180 degrees" }).boundingBox();
      const whiteSwitch = await page.getByRole("radio", { name: "White", exact: true }).boundingBox();
      expect(board).not.toBeNull();
      expect(rotate).not.toBeNull();
      expect(whiteSwitch).not.toBeNull();
      expect(rotate!.y).toBeGreaterThan(board!.y + board!.height);
      expect(Math.abs(rotate!.y - whiteSwitch!.y)).toBeLessThan(4);
    });

    test("palette rows line up with the board's left and right edges", async ({ page }) => {
      await openApp(page);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /set up a position/i }).click();

      const board = await page.getByTestId("board").first().boundingBox();
      const whiteFirst = await page.getByRole("button", { name: "white king", exact: true }).boundingBox();
      const whiteLast = await page.getByRole("button", { name: "white pawn", exact: true }).boundingBox();
      const blackFirst = await page.getByRole("button", { name: "black king", exact: true }).boundingBox();
      const blackLast = await page.getByRole("button", { name: "black pawn", exact: true }).boundingBox();
      expect(board).not.toBeNull();
      expect(whiteFirst).not.toBeNull();
      expect(whiteLast).not.toBeNull();
      expect(blackFirst).not.toBeNull();
      expect(blackLast).not.toBeNull();

      expect(Math.abs(whiteFirst!.x - board!.x)).toBeLessThan(2);
      expect(Math.abs(whiteLast!.x + whiteLast!.width - (board!.x + board!.width))).toBeLessThan(2);
      expect(Math.abs(blackFirst!.x - board!.x)).toBeLessThan(2);
      expect(Math.abs(blackLast!.x + blackLast!.width - (board!.x + board!.width))).toBeLessThan(2);
    });

    test("back pill and flip button meet the 44px hit-box minimum", async ({ page }) => {
      await openApp(page);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /set up a position/i }).click();

      const back = await page.getByRole("button", { name: "Back to menu" }).boundingBox();
      const rotate = await page.getByRole("button", { name: "Rotate the board 180 degrees" }).boundingBox();
      expect(back).not.toBeNull();
      expect(rotate).not.toBeNull();
      expect(back!.width).toBeGreaterThanOrEqual(44);
      expect(back!.height).toBeGreaterThanOrEqual(44);
      expect(rotate!.width).toBeGreaterThanOrEqual(44);
      expect(rotate!.height).toBeGreaterThanOrEqual(44);
    });
  });
}

test("the board sits noticeably higher than before the header redesign", async ({ page }) => {
  test.info().annotations.push({ type: "viewport", description: JSON.stringify(PHONE_USABLE) });
  await page.setViewportSize(PHONE_USABLE);
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  const board = await page.getByTestId("board").first().boundingBox();
  expect(board).not.toBeNull();
  // Measured on the pre-redesign build at PHONE_USABLE: board top was
  // 243.25px. SPEC_setup_header.md requires at least 30px of improvement,
  // so the new top must be at or below 243.25 - 30 = 213.25.
  expect(board!.y).toBeLessThanOrEqual(213.25);
});
