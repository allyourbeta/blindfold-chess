import { test, expect, type Page } from "@playwright/test";
import { openApp, waitForEngineReady } from "./helpers";

/**
 * Reproduces "the header gets cut off and stuck" -- reported after opening a
 * position from near the bottom of a long, scrolled list. The suspected
 * cause (docs/specs/SPEC_board_list_fixes.md): the app frame
 * (`[data-testid="app-frame"]`) is `overflow-hidden`, which is still a
 * scroll container the browser can move programmatically (e.g. scrolling a
 * tapped/focused element into view) even though nothing on screen lets the
 * player scroll it back.
 */
async function scrollListToBottom(page: Page) {
  const scroller = page.getByTestId("endgame-scroll");
  await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
}

async function assertNotStuck(page: Page, consoleErrors: string[]) {
  // 1. The back button is on screen, not scrolled above the visible area.
  const back = page.getByLabel("Back").or(page.getByLabel("Back to menu"));
  await expect(back.first()).toBeVisible();
  const box = await back.first().boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);

  // 2. The app frame itself never ends up scrolled -- there is nothing on
  // screen that could scroll it back.
  const frameScrollTop = await page.getByTestId("app-frame").evaluate((el) => el.scrollTop);
  expect(frameScrollTop).toBe(0);

  // 3. The position page's own scroller still works: down to "Source:" and
  // back up to the header.
  const scroller = page.getByTestId("endgame-scroll");
  await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect(page.getByText(/^Source:/)).toBeVisible();
  await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
  await expect(back.first()).toBeVisible();

  expect(consoleErrors).toEqual([]);
}

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

test("opening the last position after scrolling the size list does not strand the header", async ({ page }) => {
  const consoleErrors = trackConsoleErrors(page);
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Practice an endgame/i }).click();
  await page.getByTestId("size-row").filter({ hasText: /3 to 5 pieces/ }).click();

  await scrollListToBottom(page);
  await page.getByTestId("endgame-row").last().click();
  await expect(page.getByRole("button", { name: "Play Blindfold" })).toBeVisible();

  await assertNotStuck(page, consoleErrors);

  await page.getByLabel("Back").click(); // position -> size
  await expect(page.getByTestId("endgame-row").first()).toBeVisible();
  await page.getByLabel("Back").click(); // size -> home
  await expect(page.getByTestId("size-row")).toHaveCount(4);
});

test("opening the last search result after scrolling does not strand the header", async ({ page }) => {
  const consoleErrors = trackConsoleErrors(page);
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Practice an endgame/i }).click();
  await page.getByLabel("Search endgames").fill("king");

  await scrollListToBottom(page);
  await page.getByTestId("endgame-row").last().click();
  await expect(page.getByRole("button", { name: "Play Blindfold" })).toBeVisible();

  await assertNotStuck(page, consoleErrors);

  await page.getByLabel("Back").click(); // position -> size
  await expect(page.getByLabel("Search endgames")).toHaveCount(0);
});
