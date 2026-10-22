import { expect, test, type Page } from "@playwright/test";
import { keypad, waitForEngineReady, tapKeypadKey } from "./helpers";

/**
 * Records every navigator.vibrate() call instead of letting it reach the
 * (headless, non-mobile) browser -- there is no real haptic hardware to
 * feel here, but the call itself proves the wiring. Chromium-only: this is
 * about the app's call sites, not cross-browser vibrate support.
 */
async function recordVibrateCalls(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __vibrateCalls: unknown[] }).__vibrateCalls = [];
    Object.defineProperty(window.navigator, "vibrate", {
      value: (pattern: number | number[]) => {
        (window as unknown as { __vibrateCalls: unknown[] }).__vibrateCalls.push(pattern);
        return true;
      },
      configurable: true,
    });
  });
}

async function vibrateCalls(page: Page) {
  return page.evaluate(() => (window as unknown as { __vibrateCalls: unknown[] }).__vibrateCalls);
}

// Bare goto, same as strict-ticker.spec.ts: production defaults, so the
// keypad is Strict and a fully-stated illegal move actually submits.
async function startDefaultGame(page: Page) {
  await page.goto("/");
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();
}

test("keypad taps, a rejected move, and the engine's reply each fire a haptic", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one project is enough to prove the wiring");
  await recordVibrateCalls(page);
  await startDefaultGame(page);

  await tapKeypadKey(page, "Knight");
  await expect.poll(() => vibrateCalls(page)).toHaveLength(1);
  expect((await vibrateCalls(page))[0]).toBe(10);

  // Nf6 -- fully stated but illegal as White's first move. Strict submits
  // it anyway, and the app rejects it.
  await tapKeypadKey(page, "f");
  await tapKeypadKey(page, "6");
  await expect(page.getByText(/Illegal or unrecognized move/)).toBeVisible();
  const afterIllegal = await vibrateCalls(page);
  expect(afterIllegal[afterIllegal.length - 1]).toEqual([30, 60, 30, 60, 30]);

  // Nf3 -- legal. Its own taps fire their own haptics; what this checks is
  // that the engine's reply afterwards adds exactly one more.
  await tapKeypadKey(page, "Knight");
  await tapKeypadKey(page, "f");
  await tapKeypadKey(page, "3");
  const beforeEngineReply = (await vibrateCalls(page)).length;

  await expect(page.getByText(/^Black: /)).toBeVisible({ timeout: 15_000 });
  const afterEngineReply = await vibrateCalls(page);
  expect(afterEngineReply.length).toBe(beforeEngineReply + 1);
  expect(afterEngineReply[afterEngineReply.length - 1]).toBe(10);
});
