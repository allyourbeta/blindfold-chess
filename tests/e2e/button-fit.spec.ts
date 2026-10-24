import { test, expect, type Page } from "@playwright/test";
import {
  openApp,
  waitForEngineReady,
  startStandardGame,
  resignGame,
  unlock,
  assertNoButtonBelow44px,
  boxesOf,
  PHONE_USABLE,
} from "./helpers";

// SPEC_no_squeezed_buttons.md: a narrower phone than PHONE_USABLE, to catch
// a squeeze that only shows up at a smaller device width.
const NARROW_PHONE = { width: 375, height: 647 };

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

// SPEC_opponent_chip_width.md -- "Stockfish" is the longest Opponent value
// and must render as one line, inside the chip's own box, at every phone
// width down to 360px. Not "no overflow" (button-fit's existing checks) but
// specifically "no word broken across lines."
async function assertOpponentChipFits(page: Page) {
  const result = await page.evaluate(() => {
    const chip = Array.from(document.querySelectorAll("button")).find(
      (el) => (el.querySelector("span")?.textContent ?? "").trim() === "Opponent",
    );
    if (!chip) return { found: false, rectCount: 0, fits: false };
    const valueEl = chip.querySelectorAll("span")[1] as HTMLElement | undefined;
    const textNode = valueEl?.firstChild;
    if (!textNode) return { found: false, rectCount: 0, fits: false };
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    const chipBox = chip.getBoundingClientRect();
    const fits = rects.every(
      (r) =>
        r.left >= chipBox.left - 1 &&
        r.right <= chipBox.right + 1 &&
        r.top >= chipBox.top - 1 &&
        r.bottom <= chipBox.bottom + 1,
    );
    return { found: true, rectCount: rects.length, fits };
  });
  expect(result.found, "Opponent chip not found").toBe(true);
  expect(result.rectCount, `Opponent chip value rendered across ${result.rectCount} line(s)`).toBe(1);
  expect(result.fits, "Opponent chip value escapes the chip's own box").toBe(true);
}

test.describe("Opponent chip fits Stockfish without splitting a word", () => {
  for (const width of [360, 375, 393]) {
    test(`at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await page.addInitScript(() => {
        localStorage.setItem("blindfoldOpponent", "stockfish");
      });
      await openApp(page);
      await waitForEngineReady(page);
      await assertOpponentChipFits(page);
    });
  }
});

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

// SPEC_no_squeezed_buttons.md: every scrolling screen's buttons must keep
// their full designed height even when the screen's content is taller than
// the viewport (a flex column squeezes shrinkable children instead of
// scrolling them -- see assertNoButtonBelow44px).
for (const viewport of [PHONE_USABLE, NARROW_PHONE]) {
  test.describe(`button minimum height at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("menu screen", async ({ page }) => {
      await openApp(page);
      await waitForEngineReady(page);
      await assertNoButtonBelow44px(page);
    });

    test("setup screen", async ({ page }) => {
      await openApp(page);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /set up a position/i }).click();
      await assertNoButtonBelow44px(page);
    });

    test("lab home", async ({ page }) => {
      await openApp(page);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /Endgame Lab/i }).click();
      await assertNoButtonBelow44px(page);
    });

    test("size list", async ({ page }) => {
      await openApp(page);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /Endgame Lab/i }).click();
      await page.getByTestId("size-row").first().click();
      await assertNoButtonBelow44px(page);
    });

    test("favorites", async ({ page }) => {
      await openApp(page);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /Endgame Lab/i }).click();
      await page.getByTestId("favorites-row").click();
      await assertNoButtonBelow44px(page);
    });

    test("position screen", async ({ page }) => {
      await openApp(page);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /Endgame Lab/i }).click();
      await page.getByTestId("size-row").first().click();
      await page.getByTestId("endgame-row").first().click();
      await assertNoButtonBelow44px(page);
    });

    test("play screen", async ({ page }) => {
      await startStandardGame(page);
      // O-O / O-O-O / Undo last entry grew to 44px in portrait
      // (SPEC_final_polish.md, Button.tsx's "keypadRow" size) -- no
      // exemption needed here any more. They're still 36px under
      // `shortscape`, covered separately in auditChecks.ts's check B.
      await assertNoButtonBelow44px(page);
    });
  });
}

// SPEC_final_polish.md Part 3: the castle/backspace row grows to 44px in
// portrait but stays 36px under `shortscape` -- the message log, not these
// keys, is what's supposed to shrink on a short landscape phone.
test.describe("keypad row height", () => {
  test("O-O / O-O-O / Undo last entry are 44px tall at PHONE_USABLE", async ({ page }) => {
    await page.setViewportSize(PHONE_USABLE);
    await startStandardGame(page);
    const boxes = await boxesOf(page);
    for (const label of ["O-O", "O-O-O", "Undo last entry"]) {
      const box = boxes.find((b) => b.label === label);
      expect(box, `no button labeled "${label}"`).toBeTruthy();
      expect(box!.h, `${label} is ${box!.h}px tall`).toBeGreaterThanOrEqual(44 - 0.5);
    }
  });

  test("O-O / O-O-O / Undo last entry are still 36px tall at 742x393 landscape", async ({ page }) => {
    await page.setViewportSize({ width: 742, height: 393 });
    await startStandardGame(page);
    const boxes = await boxesOf(page);
    for (const label of ["O-O", "O-O-O", "Undo last entry"]) {
      const box = boxes.find((b) => b.label === label);
      expect(box, `no button labeled "${label}"`).toBeTruthy();
      expect(box!.h, `${label} is ${box!.h}px tall`).toBeLessThan(44 - 0.5);
      expect(box!.h, `${label} is ${box!.h}px tall`).toBeGreaterThanOrEqual(36 - 0.5);
    }
  });
});
