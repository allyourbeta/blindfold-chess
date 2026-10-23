import { test, expect, type Page } from "@playwright/test";
import { openApp, waitForEngineReady, keypad, PHONE_USABLE } from "./helpers";

// SPEC_lab_headers_edit.md: every Endgame Lab header matches the setup
// header's look (chevron pill, centered bold title, right control), and the
// position screen gains an Edit position button that opens Position Setup
// preloaded with that position.

async function openEndgames(page: Page) {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Endgame Lab/i }).click();
}

function pill(page: Page) {
  return page.getByLabel("Back");
}

function header(page: Page) {
  return page.locator("header");
}

async function assertTitleCenteredAndOneLine(page: Page) {
  const headerBox = await header(page).boundingBox();
  const titleBox = await header(page).locator("h1").boundingBox();
  expect(headerBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  const headerCenter = headerBox!.x + headerBox!.width / 2;
  const titleCenter = titleBox!.x + titleBox!.width / 2;
  expect(Math.abs(headerCenter - titleCenter)).toBeLessThan(4);

  // "One line": whitespace-nowrap forbids the browser from ever wrapping the
  // title onto a second line -- the structural guarantee, not a pixel guess.
  const whiteSpace = await header(page).locator("h1").evaluate((el) => getComputedStyle(el).whiteSpace);
  expect(whiteSpace).toBe("nowrap");
}

async function assertPillAtLeast44(page: Page) {
  const box = await pill(page).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44 - 0.5);
  expect(box!.height).toBeGreaterThanOrEqual(44 - 0.5);
}

/** Maps every square on the first visible board to its piece's accessible name, e.g. {"e1": "white king"}. */
async function boardPieceMap(page: Page): Promise<Record<string, string>> {
  return page.locator('[data-square]').first().evaluate(() => {
    const out: Record<string, string> = {};
    document.querySelectorAll<HTMLElement>("[data-square]").forEach((sq) => {
      const square = sq.getAttribute("data-square");
      const img = sq.querySelector("img");
      if (square && img) out[square] = img.getAttribute("alt") ?? "";
    });
    return out;
  });
}

function registerHeaderChecks(width: number, height: number) {
  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test("lab home: title, no subtitle, Menu pill", async ({ page }) => {
      await openEndgames(page);
      await expect(page.getByRole("heading", { name: "Endgame Lab" })).toBeVisible();
      await expect(page.getByText("Pick a size, or search.")).toHaveCount(0);
      await expect(pill(page)).toHaveText("Menu");
      await assertTitleCenteredAndOneLine(page);
    });

    test("size list: Back pill, centered title, subtitle present", async ({ page }) => {
      await openEndgames(page);
      await page.getByTestId("size-row").first().click();
      await expect(pill(page)).toHaveText("Back");
      await assertTitleCenteredAndOneLine(page);
      await expect(header(page).locator("p")).toBeVisible();
    });

    test("favorites: Back pill, centered title, subtitle present", async ({ page }) => {
      await openEndgames(page);
      await page.getByTestId("favorites-row").click();
      await expect(pill(page)).toHaveText("Back");
      await assertTitleCenteredAndOneLine(page);
      await expect(header(page).locator("p")).toBeVisible();
    });

    test("position: Back pill, centered title, subtitle present", async ({ page }) => {
      await openEndgames(page);
      await page.getByTestId("size-row").first().click();
      await page.getByTestId("endgame-row").first().click();
      await expect(pill(page)).toHaveText("Back");
      await assertTitleCenteredAndOneLine(page);
      await expect(header(page).locator("p")).toBeVisible();
    });

    test("position: Play Blindfold spans the full width; the row below shares a top", async ({ page }) => {
      await openEndgames(page);
      await page.getByTestId("size-row").first().click();
      await page.getByTestId("endgame-row").first().click();

      const play = await page.getByRole("button", { name: "Play Blindfold" }).boundingBox();
      const another = await page.getByRole("button", { name: "Next" }).boundingBox();
      const edit = await page.getByRole("button", { name: "Edit" }).boundingBox();
      expect(play).not.toBeNull();
      expect(another).not.toBeNull();
      expect(edit).not.toBeNull();

      const belowRowWidth = edit!.x + edit!.width - another!.x;
      expect(Math.abs(play!.width - belowRowWidth)).toBeLessThanOrEqual(2);
      expect(Math.abs(another!.y - edit!.y)).toBeLessThanOrEqual(2);
    });

    test("every lab pill is at least 44x44", async ({ page }) => {
      await openEndgames(page);
      await assertPillAtLeast44(page);
      await page.getByTestId("size-row").first().click();
      await assertPillAtLeast44(page);
      await page.getByTestId("endgame-row").first().click();
      await assertPillAtLeast44(page);
    });

    test("Edit position opens Position Setup with the same pieces, squares and side to move; Play Blindfold starts a game", async ({
      page,
    }) => {
      await openEndgames(page);
      await page.getByTestId("size-row").first().click();
      await page.getByTestId("endgame-row").first().click();

      const sideText = await page.getByText(/^(White|Black) to move$/).textContent();
      const expectedSide = /^White/.test(sideText ?? "") ? "White" : "Black";
      const before = await boardPieceMap(page);
      expect(Object.keys(before).length).toBeGreaterThan(0);

      await page.getByRole("button", { name: "Edit" }).click();
      await expect(page.getByRole("heading", { name: "Position Setup" })).toBeVisible();

      const after = await boardPieceMap(page);
      expect(after).toEqual(before);
      await expect(page.getByRole("radio", { name: expectedSide })).toHaveAttribute("aria-checked", "true");

      await page.getByRole("button", { name: "Play Blindfold" }).click();
      await expect(keypad(page)).toBeVisible();
    });
  });
}

registerHeaderChecks(PHONE_USABLE.width, PHONE_USABLE.height);
registerHeaderChecks(360, 740);
