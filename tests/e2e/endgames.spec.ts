import { test, expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import {
  openApp,
  waitForEngineReady,
  keypad,
  submitMove,
  tapMoreAction,
  boxesOf,
  startStandardGame,
  assertBoardIsSquare,
  resignGame,
} from "./helpers";

async function openEndgames(page: Page) {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Practice an endgame/i }).click();
}

async function openSize(page: Page, name: RegExp) {
  await page.getByTestId("size-row").filter({ hasText: name }).click();
}

/** Opens the More sheet, reads the FEN message it adds, then closes the sheet again. */
async function readCurrentFen(page: Page): Promise<string> {
  await tapMoreAction(page, /FEN/);
  const text = await page.getByText(/^\S+ [wb] /).last().textContent();
  await page.getByRole("button", { name: "Close more actions" }).click();
  return (text ?? "").trim();
}

/** A legal move from `fen` that doesn't itself end the game, so an engine reply can be observed. */
function pickNonTerminalMove(fen: string): { san: string; endsGame: boolean } {
  const chess = new Chess(fen);
  for (const san of chess.moves()) {
    const probe = new Chess(fen);
    probe.move(san);
    if (!probe.isGameOver()) return { san, endsGame: false };
  }
  return { san: chess.moves()[0], endsGame: true };
}

/** Walks every size from the endgames home until it finds a Black-to-move row in `sizeName`, and opens it. */
async function openABlackToMoveEntry(page: Page, sizeName: RegExp) {
  await openSize(page, sizeName);
  const rows = page.getByTestId("endgame-row");
  const texts = await rows.allTextContents();
  const index = texts.findIndex((t) => /Black to move/.test(t));
  if (index === -1) throw new Error(`No Black-to-move entry found in ${sizeName} -- the catalog may be malformed.`);
  await rows.nth(index).click();
}

test("Home -> 3 to 5 pieces -> first named entry -> Play Blindfold -> one move -> reply", async ({ page }) => {
  await openEndgames(page);
  await openSize(page, /3 to 5 pieces/);

  // Each card's accessible name is "<label>, <side> to move, <n> pieces" --
  // an unnamed entry's label is "#N" (Part 3's cardLabelFor), so a named
  // entry is exactly the one whose accessible name doesn't start with "#".
  const rows = page.getByTestId("endgame-row");
  const labels = await rows.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  let index = labels.findIndex((t) => !/^#\d+,/.test(t));
  const usedFallback = index === -1;
  if (usedFallback) index = 0;
  expect(index, "3 to 5 pieces should have at least one position").toBeGreaterThanOrEqual(0);
  if (usedFallback) {
    test.info().annotations.push({ type: "note", description: "No named entry in 3 to 5 pieces; used the first position instead." });
  }

  await rows.nth(index).click();
  await expect(page.getByText(/You play (White|Black)\. \d+ pieces\./)).toBeVisible();

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  const fen = await readCurrentFen(page);
  const { san, endsGame } = pickNonTerminalMove(fen);
  await submitMove(page, san);
  await expect(page.getByText(`: ${san}`)).toBeVisible();

  if (!endsGame) {
    // The player's move plus the engine's reply: two "White: .../Black: ..." lines.
    await expect(page.getByText(/^(White|Black): /)).toHaveCount(2, { timeout: 15_000 });
  }
});

test("a Black-to-move endgame from 12 to 16 pieces forces you onto Black, without changing the White setting", async ({
  page,
}) => {
  await openEndgames(page);
  await openABlackToMoveEntry(page, /12 to 16 pieces/);
  await expect(page.getByText(/You play Black\. \d+ pieces\./)).toBeVisible();

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await page.getByLabel("Back to menu").click();
  await expect(page.locator("#game-settings-summary").getByText("White", { exact: true })).toBeVisible();
});

test("search narrows the size list to matches; a no-match query offers Clear search", async ({ page }) => {
  await openEndgames(page);
  const search = page.getByLabel("Search endgames");

  // "rook" matches at least every rook-family position via its family label.
  await search.fill("rook");
  await expect(page.getByTestId("size-row")).toHaveCount(0);
  await expect(page.getByTestId("endgame-row").first()).toBeVisible();

  await search.fill("zzzz");
  await expect(page.getByText(/No endgames match/)).toBeVisible();
  await expect(page.getByTestId("endgame-row")).toHaveCount(0);

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByTestId("size-row")).toHaveCount(4);
});

test("game over in an endgame: Try again replays the same position, Endgames lands on the size view", async ({
  page,
}) => {
  await openEndgames(page);
  await openSize(page, /6 to 8 pieces/);
  await page.getByTestId("endgame-row").first().click();
  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  const fenBefore = await readCurrentFen(page);

  await resignGame(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Another of this size" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Copy PGN" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Endgames" })).toBeVisible();
  await expect(dialog.getByText(/Goal was a/)).toHaveCount(0);

  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(keypad(page)).toBeVisible();
  expect(await readCurrentFen(page)).toBe(fenBefore);

  await resignGame(page);
  await page.getByRole("dialog").getByRole("button", { name: "Endgames" }).click();
  await expect(page.getByText(/^\d+ positions$/)).toBeVisible();
  await expect(page.getByTestId("size-row")).toHaveCount(0);
});

test("a normal game's game-over panel is unchanged by the endgame feature", async ({ page }) => {
  await startStandardGame(page);
  await resignGame(page);

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "New Game" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Copy PGN" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await expect(dialog.getByText(/Goal was a/)).toHaveCount(0);
});

test("every back arrow returns where expected: position -> size -> home -> menu", async ({ page }) => {
  await openEndgames(page);
  await openSize(page, /9 to 11 pieces/);
  await page.getByTestId("endgame-row").first().click();
  await expect(page.getByRole("button", { name: "Play Blindfold" })).toBeVisible();

  await page.getByLabel("Back").click(); // position -> size
  await expect(page.getByTestId("endgame-row").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "9 to 11 pieces" })).toBeVisible();

  await page.getByLabel("Back").click(); // size -> home
  await expect(page.getByTestId("size-row")).toHaveCount(4);

  await page.getByLabel("Back").click(); // home -> menu
  await expect(page.getByRole("button", { name: /Practice an endgame/i })).toBeVisible();
});

// Checklist rule 11: the overlap/viewport scan extended to the renamed size
// screen, at the iphone project's own size and at landscape 844x390 -- same
// thresholds as landscape.spec.ts, with one deliberate difference: these
// three views are plain `overflow-y-auto` scrolling pages (the same pattern
// SetupScreen already uses), not PlayScreen's fixed, never-scrolls grid. A
// row below the fold legitimately has y > viewport height before anyone
// scrolls -- that's normal list content, not a clipped control. Horizontal
// escape, negative-origin escape, and overlap are still real bugs regardless
// of scroll position, so those stay checked on every control.
async function assertNoEscapeOrOverlap(page: Page, width: number) {
  const boxes = await boxesOf(page);
  const escaped = boxes.filter((b) => b.x + b.w > width + 0.5 || b.x < -0.5 || b.y < -0.5);
  const collisions: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (overlapX > 1 && overlapY > 1) collisions.push(`${a.label} x ${b.label}`);
    }
  }
  expect(escaped.map((b) => b.label)).toEqual([]);
  expect(collisions).toEqual([]);
}

function registerUiChecks(width: number, height: number) {
  test(`${width}x${height}: endgames home has no escaped or overlapping control`, async ({ page }) => {
    await openEndgames(page);
    await assertNoEscapeOrOverlap(page, width);
  });

  test(`${width}x${height}: endgames size has no escaped or overlapping control`, async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await assertNoEscapeOrOverlap(page, width);
  });

  test(`${width}x${height}: endgames position has no escaped or overlapping control`, async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await page.getByTestId("endgame-row").first().click();
    await assertNoEscapeOrOverlap(page, width);
  });
}

test.describe("UI check: iphone portrait", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  registerUiChecks(390, 844);
});

test.describe("UI check: landscape", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  registerUiChecks(844, 390);
});

// Part 2's labels-inside-the-frame redesign (board-and-list.html, option B)
// removed the separate rank gutter and file row -- the board's own width is
// now the whole story, so a layout regression there stretches every
// square. Checked at both orientations the app ships.
function registerSquareBoardCheck(width: number, height: number) {
  test(`${width}x${height}: the endgame preview board is square`, async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await page.getByTestId("endgame-row").first().click();
    await assertBoardIsSquare(page);
  });
}

test.describe("square board: iphone portrait", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  registerSquareBoardCheck(390, 844);
});

test.describe("square board: landscape", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  registerSquareBoardCheck(844, 390);
});

// Part 4's screenshot set, written on every run so they can be compared
// against docs/targets/endgames.html by eye.
test.describe("screenshots for visual comparison", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  test("endgames-home.png", async ({ page }) => {
    await openEndgames(page);
    await page.screenshot({ path: "test-results/endgames-home.png" });
  });

  test("endgames-size.png", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await page.screenshot({ path: "test-results/endgames-size.png" });
  });

  test("endgames-position.png and endgames-position-dark.png", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await page.getByTestId("endgame-row").first().click();
    await page.screenshot({ path: "test-results/endgames-position.png" });

    await page.evaluate(() => localStorage.setItem("blindfoldTheme", "dark"));
    await page.reload();
    await waitForEngineReady(page);
    await page.getByRole("button", { name: /Practice an endgame/i }).click();
    await openSize(page, /6 to 8 pieces/);
    await page.getByTestId("endgame-row").first().click();
    await page.screenshot({ path: "test-results/endgames-position-dark.png" });
  });

  test("endgames-position-black.png", async ({ page }) => {
    await openEndgames(page);
    await openABlackToMoveEntry(page, /12 to 16 pieces/);
    await page.screenshot({ path: "test-results/endgames-position-black.png" });
  });

  test("endgames-search-empty.png", async ({ page }) => {
    await openEndgames(page);
    await page.getByLabel("Search endgames").fill("zzzz");
    await page.screenshot({ path: "test-results/endgames-search-empty.png" });
  });

  test("endgames-gameover.png", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /3 to 5 pieces/);
    await page.getByTestId("endgame-row").first().click();
    await page.getByRole("button", { name: "Play Blindfold" }).click();
    await expect(keypad(page)).toBeVisible();
    await resignGame(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: "test-results/endgames-gameover.png" });
  });

  // Part 5's named set, for board-and-list.html. endgames-size-grid.png
  // doubles as the catalog-states check (rule 14): unnamed and named
  // entries side by side -- "6 to 8 pieces" has both (SPEC's own
  // decisions section).
  test("endgames-size-grid.png and endgames-size-grid-dark.png", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await page.screenshot({ path: "test-results/endgames-size-grid.png" });

    await page.evaluate(() => localStorage.setItem("blindfoldTheme", "dark"));
    await page.reload();
    await waitForEngineReady(page);
    await page.getByRole("button", { name: /Practice an endgame/i }).click();
    await openSize(page, /6 to 8 pieces/);
    await page.screenshot({ path: "test-results/endgames-size-grid-dark.png" });
  });

  test("endgames-search-grid.png", async ({ page }) => {
    await openEndgames(page);
    await page.getByLabel("Search endgames").fill("rook");
    await expect(page.getByTestId("endgame-row").first()).toBeVisible();
    await page.screenshot({ path: "test-results/endgames-search-grid.png" });
  });

  // Labels-inside-the-frame set (Part 2, option B). Taken from real WebKit
  // when it's installed, per the spec -- these two alone are skipped on the
  // Chromium-based projects so the file is never overwritten by a
  // Chromium render of the same screen.
  test("endgames-position-labels.png", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "webkit-iphone", "taken from real WebKit when it's installed");
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await page.getByTestId("endgame-row").first().click();
    await page.screenshot({ path: "test-results/endgames-position-labels.png" });
  });

  test("endgames-position-black-labels.png", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "webkit-iphone", "taken from real WebKit when it's installed");
    await openEndgames(page);
    await openABlackToMoveEntry(page, /12 to 16 pieces/);
    await page.screenshot({ path: "test-results/endgames-position-black-labels.png" });
  });
});
