import { test, expect, type Page } from "@playwright/test";
import { openApp, waitForEngineReady, startStandardGame, resignGame, unlock } from "./helpers";

// SPEC_button_text_and_remove.md Part 4 -- every button's label grew from
// 14px to 16px in this round. This is the guard against the side effect:
// a label that now clips, or a page that gained horizontal scroll.

async function assertNoClippedButtons(page: Page) {
  const clipped = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter((el) => el.getBoundingClientRect().width > 0 || el.getBoundingClientRect().height > 0)
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "?").trim().slice(0, 40)),
  );
  expect(clipped).toEqual([]);

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalScroll).toBe(false);
}

/**
 * SPEC_log_opponent_style.md Part D, rule 11 -- every button's label is
 * centered via CSS `text-box: trim-both cap alphabetic`, set once on
 * `button` in src/index.css's base layer. Confirmed directly against the
 * computed style (the Chromium this suite runs on, 151, supports the
 * property) rather than the stylesheet-rule-text fallback the spec allows
 * for an unsupporting test browser.
 */
async function assertButtonsAreTextBoxTrimmed(page: Page) {
  const untrimmed = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter((el) => el.getBoundingClientRect().width > 0 || el.getBoundingClientRect().height > 0)
      .filter((el) => getComputedStyle(el).textBoxTrim !== "trim-both")
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "?").trim().slice(0, 40)),
  );
  expect(untrimmed).toEqual([]);
}

test.describe("button fit at 360x740", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("menu screen", async ({ page }) => {
    await openApp(page);
    await waitForEngineReady(page);
    await assertNoClippedButtons(page);
    await assertButtonsAreTextBoxTrimmed(page);
    await page.screenshot({ path: "qa/button-text-16px-menu.png" });
  });

  test("setup screen", async ({ page }) => {
    await openApp(page);
    await waitForEngineReady(page);
    await page.getByRole("button", { name: /set up a position/i }).click();
    await assertNoClippedButtons(page);
    await assertButtonsAreTextBoxTrimmed(page);
  });

  test("play screen and the end-of-game panel", async ({ page }) => {
    await startStandardGame(page);
    await assertNoClippedButtons(page);
    await assertButtonsAreTextBoxTrimmed(page);
    await page.screenshot({ path: "qa/button-text-16px-play.png" });

    await resignGame(page);
    await assertNoClippedButtons(page);
  });

  test("endgames home", async ({ page }) => {
    await openApp(page);
    await waitForEngineReady(page);
    await page.getByRole("button", { name: /Endgame Lab/i }).click();
    await assertNoClippedButtons(page);
  });

  test("an endgame list", async ({ page }) => {
    await openApp(page);
    await waitForEngineReady(page);
    await page.getByRole("button", { name: /Endgame Lab/i }).click();
    await page.getByTestId("size-row").filter({ hasText: /6 or more pieces/ }).click();
    await assertNoClippedButtons(page);
  });

  test("a position screen, with #creator unlocked", async ({ page }) => {
    await unlock(page, "hunter2", true);
    await page.getByRole("button", { name: /New Game/ }).waitFor();
    await page.getByRole("button", { name: /Endgame Lab/i }).click();
    await page.getByTestId("size-row").filter({ hasText: /6 or more pieces/ }).click();
    await page.getByTestId("endgame-row").first().click();
    await assertNoClippedButtons(page);
    await page.screenshot({ path: "qa/button-text-16px-position.png" });
  });
});
