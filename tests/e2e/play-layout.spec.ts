import { test, expect, type Page } from "@playwright/test";
import { keypad, waitForEngineReady, PHONE_USABLE } from "./helpers";

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

  // SPEC_last_quirks_and_mute.md Part B -- on phones the app frame's own
  // background is now bg-base (the same beige as the OS bands above/below
  // it), not bg-surface. Compared against a probe element holding the raw
  // token rather than a hardcoded hex, so this stays correct if the token's
  // value ever changes.
  test("the app frame's background is bg-base, not bg-surface", async ({ page }) => {
    await startAndRejectAMove(page);

    const { frameBg, baseToken } = await page.evaluate(() => {
      const frame = document.querySelector('[data-testid="app-frame"]') as HTMLElement;
      const probe = document.createElement("div");
      probe.style.background = "var(--color-bg-base)";
      document.body.appendChild(probe);
      const baseToken = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { frameBg: getComputedStyle(frame).backgroundColor, baseToken };
    });
    expect(frameBg).toBe(baseToken);
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
