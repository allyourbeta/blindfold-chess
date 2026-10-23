import { test, expect, type Page } from "@playwright/test";
import { openApp, waitForEngineReady, assertNoButtonBelow44px, PHONE_USABLE } from "./helpers";

// A second, narrower phone -- SPEC_no_squeezed_buttons.md. PHONE_USABLE
// (393x742) is the install-calibrated height; this adds a narrower width to
// catch a squeeze that only shows up on a smaller device.
const NARROW_PHONE = { width: 375, height: 647 };

// SPEC_buttons_results.md Part 4, checklist rule 11: "no thin strips" (the
// design rule behind the square/random buttons this round) becomes an
// automated check instead of staying a design review note.

async function openEndgames(page: Page) {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Endgame Lab/i }).click();
}

async function openSize(page: Page, name: RegExp) {
  await page.getByTestId("size-row").filter({ hasText: name }).click();
}

interface TapTarget {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isListItem: boolean;
}

/**
 * Every visible button, plus whether it's a control that legitimately runs
 * the full width of the screen: a list row/card (data-testid "endgame-row"
 * or inside a Card), or a button that is itself a direct child of a lab
 * screen's scroll container (SPEC_lab_headers_edit.md's full-width Play
 * Blindfold row) -- the flex column there stretches every direct child to
 * its own full width, same as a list row does.
 */
async function tapTargets(page: Page): Promise<TapTarget[]> {
  return page.evaluate(() => {
    const out: TapTarget[] = [];
    document.querySelectorAll<HTMLElement>("button").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const isListItem =
        el.getAttribute("data-testid") === "endgame-row" ||
        el.closest('[data-testid="card"]') !== null ||
        el.parentElement?.getAttribute("data-testid") === "endgame-scroll";
      out.push({
        label: (el.getAttribute("aria-label") || el.textContent || "?").trim().slice(0, 40),
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        isListItem,
      });
    });
    return out;
  });
}

/**
 * Every button is at least 44px tall, and none is wider than 4x its own
 * height unless it's a list row or card (those legitimately run the full
 * width of the screen).
 */
async function assertNoThinStrips(page: Page) {
  await assertNoButtonBelow44px(page);

  const targets = await tapTargets(page);
  const tooWide = targets.filter((t) => !t.isListItem && t.w > t.h * 4 + 0.5);
  expect(tooWide.map((t) => `${t.label} (${t.w.toFixed(0)}x${t.h.toFixed(0)})`)).toEqual([]);
}

// Checked at two phone sizes -- SPEC_no_squeezed_buttons.md. The old
// 390x844-only run never shrank a flex child below its minimum, because
// everything fit; a real iPhone's usable height does not.
for (const viewport of [PHONE_USABLE, NARROW_PHONE]) {
  test.describe(`tap targets: iphone portrait ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test("endgames home has no thin strip", async ({ page }) => {
      await openEndgames(page);
      await assertNoThinStrips(page);
    });

    test("endgames size has no thin strip", async ({ page }) => {
      await openEndgames(page);
      await openSize(page, /6 or more pieces/);
      await assertNoThinStrips(page);
    });

    test("endgames favorites has no thin strip", async ({ page }) => {
      await openEndgames(page);
      await page.getByTestId("favorites-row").click();
      await assertNoThinStrips(page);
    });

    test("endgames position has no thin strip", async ({ page }) => {
      await openEndgames(page);
      await openSize(page, /6 or more pieces/);
      await page.getByTestId("endgame-row").first().click();
      await assertNoThinStrips(page);
    });
  });
}

test.describe("play blindfold full height regression", () => {
  test.use({ viewport: PHONE_USABLE, isMobile: true, hasTouch: true });

  // SPEC_no_squeezed_buttons.md: Round 91 made Play Blindfold a direct
  // flex child that could shrink to its text height (~21px) instead of the
  // screen scrolling. Opened through the UI, never a hard-coded position
  // code, so this follows whichever position the catalog puts first.
  test("endgames position: Play Blindfold renders at full height", async ({ page }) => {
    await openEndgames(page);
    await page.getByTestId("size-row").first().click();
    await page.getByTestId("endgame-row").first().click();
    const box = await page.getByRole("button", { name: /Play Blindfold/i }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(60);
  });
});

// Part 5's screenshot set, for docs/targets/buttons-results.html.
test.describe("screenshots for visual comparison", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  test("endgames-home-random.png", async ({ page }) => {
    await openEndgames(page);
    await page.screenshot({ path: "test-results/endgames-home-random.png" });
  });

  test("endgames-size-random.png", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 or more pieces/);
    await page.screenshot({ path: "test-results/endgames-size-random.png" });
  });

  test("endgames-favorites-random.png", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /3 to 5 pieces/);
    await page.getByTestId("endgame-row").first().click();
    await page.getByRole("button", { name: "Add to favorites" }).click();
    await page.getByLabel("Back").click();
    await page.getByLabel("Back").click();
    await page.getByTestId("favorites-row").click();
    await page.screenshot({ path: "test-results/endgames-favorites-random.png" });
  });
});
