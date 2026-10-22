import { test, expect, type Page } from "@playwright/test";
import { keypad, waitForEngineReady } from "./helpers";

/**
 * Stands in for Ashish's installed iPhone, which loses ~93px to the status
 * bar and home indicator that this project's `iphone` Playwright project
 * (390x844, no safe-area insets) never accounts for -- see
 * SPEC_log_opponent_style.md. Calibrated empirically against the OLD build
 * (before this spec's Part A fixes): at width 393, this is the height where
 * the message log (after a game starts and an illegal move is rejected)
 * measured 34-40px tall -- under 1.5 lines, matching his 2026-10-22 11:44
 * screenshot. Measured value at 393x742 on the old build: 36px. Never widen
 * this to the raw 390x844 device size; that has ~90px more room than his
 * phone and would hide this regression again.
 */
const PHONE_USABLE = { width: 393, height: 742 };

/**
 * A bare goto, same as strict-ticker.spec.ts: production defaults (ticker
 * hidden, keypad strict). Nf6 is fully stated and illegal as White's first
 * move, and Strict submits it anyway so the rejection lands in the log.
 */
async function startAndRejectAMove(page: Page) {
  await page.goto("/");
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /New Game/ }).click();
  const kp = keypad(page);
  await expect(kp).toBeVisible();
  await kp.getByRole("button", { name: "Knight" }).click();
  await kp.getByRole("button", { name: "f6", exact: true }).click();
  await kp.getByRole("button", { name: "f6", exact: true }).click();
  await expect(page.getByText(/Illegal or unrecognized move/)).toBeVisible();
}

test.describe("phone-usable layout", () => {
  test.use({ viewport: PHONE_USABLE });

  test("the message log is at least three lines tall and the action bar stays on screen", async ({ page }) => {
    await startAndRejectAMove(page);

    const log = page.getByTestId("message-log");
    const { logHeight, rowLineHeight } = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="message-log"]') as HTMLElement;
      const row = el.firstElementChild as HTMLElement;
      return { logHeight: el.clientHeight, rowLineHeight: parseFloat(getComputedStyle(row).lineHeight) };
    });
    expect(logHeight, `log is only ${logHeight}px tall (line-height ${rowLineHeight}px)`).toBeGreaterThanOrEqual(
      3 * rowLineHeight,
    );
    void log;

    const actionBarBottom = await page.getByTestId("action-bar").evaluate((el) => el.getBoundingClientRect().bottom);
    expect(actionBarBottom).toBeLessThanOrEqual(PHONE_USABLE.height);
  });
});

test.describe("small iPhone usable area", () => {
  test.use({ viewport: { width: 375, height: 647 } });

  test("the action bar is fully visible and no button is clipped", async ({ page }) => {
    await startAndRejectAMove(page);

    const actionBarBottom = await page.getByTestId("action-bar").evaluate((el) => el.getBoundingClientRect().bottom);
    expect(actionBarBottom).toBeLessThanOrEqual(647);

    const clipped = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .filter((el) => el.getBoundingClientRect().width > 0 || el.getBoundingClientRect().height > 0)
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => (el.getAttribute("aria-label") || el.textContent || "?").trim().slice(0, 40)),
    );
    expect(clipped).toEqual([]);
  });
});
