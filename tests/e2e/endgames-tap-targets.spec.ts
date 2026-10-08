import { test, expect, type Page } from "@playwright/test";
import { openApp, waitForEngineReady } from "./helpers";

// SPEC_buttons_results.md Part 4, checklist rule 11: "no thin strips" (the
// design rule behind the square/random buttons this round) becomes an
// automated check instead of staying a design review note.

async function openEndgames(page: Page) {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Practice an endgame/i }).click();
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

/** Every visible button, plus whether it's a list row/card (data-testid "endgame-row" or inside a Card). */
async function tapTargets(page: Page): Promise<TapTarget[]> {
  return page.evaluate(() => {
    const out: TapTarget[] = [];
    document.querySelectorAll<HTMLElement>("button").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const isListItem = el.getAttribute("data-testid") === "endgame-row" || el.closest('[data-testid="card"]') !== null;
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
function assertNoThinStrips(targets: TapTarget[]) {
  const tooShort = targets.filter((t) => t.h < 44 - 0.5);
  expect(tooShort.map((t) => `${t.label} (${t.w.toFixed(0)}x${t.h.toFixed(0)})`)).toEqual([]);

  const tooWide = targets.filter((t) => !t.isListItem && t.w > t.h * 4 + 0.5);
  expect(tooWide.map((t) => `${t.label} (${t.w.toFixed(0)}x${t.h.toFixed(0)})`)).toEqual([]);
}

test.describe("tap targets: iphone portrait", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("endgames home has no thin strip", async ({ page }) => {
    await openEndgames(page);
    assertNoThinStrips(await tapTargets(page));
  });

  test("endgames size has no thin strip", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    assertNoThinStrips(await tapTargets(page));
  });

  test("endgames favorites has no thin strip", async ({ page }) => {
    await openEndgames(page);
    await page.getByTestId("favorites-row").click();
    assertNoThinStrips(await tapTargets(page));
  });

  test("endgames position has no thin strip", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await page.getByTestId("endgame-row").first().click();
    assertNoThinStrips(await tapTargets(page));
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
    await openSize(page, /6 to 8 pieces/);
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
