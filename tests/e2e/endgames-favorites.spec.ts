import { test, expect, type Page } from "@playwright/test";
import { openApp, waitForEngineReady } from "./helpers";

async function openEndgames(page: Page) {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Practice an endgame/i }).click();
}

async function openSize(page: Page, name: RegExp) {
  await page.getByTestId("size-row").filter({ hasText: name }).click();
}

test("star a position, it persists across reload, shows up in Favorites, and unstarring empties it", async ({
  page,
}) => {
  await openEndgames(page);
  await openSize(page, /3 to 5 pieces/);
  await page.getByTestId("endgame-row").first().click();

  const star = page.getByRole("button", { name: "Add to favorites" });
  await expect(star).toHaveAttribute("aria-pressed", "false");
  await star.click();
  await expect(page.getByRole("button", { name: "Remove from favorites" })).toHaveAttribute("aria-pressed", "true");

  // Back to the size grid: this card now shows the favorite star.
  await page.getByLabel("Back").click();
  await expect(page.getByTestId("card-favorite-star").first()).toBeVisible();

  // Back to home: the Favorites row shows a count of 1.
  await page.getByLabel("Back").click();
  await expect(page.getByTestId("favorites-row")).toContainText("1");

  // Reload the page -- proves the favorite was actually written to storage,
  // not just held in memory (Part 4's red-before-green: breaking
  // setFavorites makes exactly this assertion fail).
  await page.reload();
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Practice an endgame/i }).click();
  await expect(page.getByTestId("favorites-row")).toContainText("1");

  await page.getByTestId("favorites-row").click();
  await expect(page.getByRole("heading", { name: "Favorites" })).toBeVisible();
  await expect(page.getByText(/^1 position$/)).toBeVisible();
  await expect(page.getByTestId("endgame-row")).toHaveCount(1);

  await page.getByTestId("endgame-row").first().click();
  await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
  await page.getByRole("button", { name: "Remove from favorites" }).click();

  // A position opened from Favorites returns to Favorites, not to its size bucket.
  await page.getByLabel("Back").click();
  await expect(page.getByRole("heading", { name: "Favorites" })).toBeVisible();
  await expect(page.getByText("None yet")).toBeVisible();
  await expect(page.getByText("No favorites yet.")).toBeVisible();
  await expect(page.getByTestId("endgame-row")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Random favorite" })).toHaveCount(0);
});

test("Favorites, empty from the start: no random button, and the empty-state message", async ({ page }) => {
  await openEndgames(page);
  await page.getByTestId("favorites-row").click();
  await expect(page.getByRole("heading", { name: "Favorites" })).toBeVisible();
  await expect(page.getByText("None yet")).toBeVisible();
  await expect(page.getByText("No favorites yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Random favorite" })).toHaveCount(0);
  await expect(page.getByTestId("endgame-row")).toHaveCount(0);
});

// Checklist rule 11: overlap/escape scan extended to the favorites screen and
// the position header with its new star button. Same thresholds and
// reasoning as endgames.spec.ts's own scan (plain overflow-y-auto pages).
async function boxesOf(page: Page) {
  return page.evaluate(() => {
    const out: { x: number; y: number; w: number; h: number; label: string }[] = [];
    document.querySelectorAll<HTMLElement>("button, input, [role=button]").forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      out.push({ x: r.x, y: r.y, w: r.width, h: r.height, label: el.getAttribute("aria-label") ?? `el${i}` });
    });
    return out;
  });
}

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
  test(`${width}x${height}: favorites screen has no escaped or overlapping control`, async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /3 to 5 pieces/);
    await page.getByTestId("endgame-row").first().click();
    await page.getByRole("button", { name: "Add to favorites" }).click();
    await page.getByLabel("Back").click();
    await page.getByLabel("Back").click();
    await page.getByTestId("favorites-row").click();
    await assertNoEscapeOrOverlap(page, width);
  });

  test(`${width}x${height}: position header with the favorite star has no escaped or overlapping control`, async ({
    page,
  }) => {
    await openEndgames(page);
    await openSize(page, /3 to 5 pieces/);
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

test.describe("screenshots for visual comparison", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  test("endgames-home-favorites.png", async ({ page }) => {
    await openEndgames(page);
    await page.screenshot({ path: "test-results/endgames-home-favorites.png" });
  });

  test("endgames-size-ids.png", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await page.screenshot({ path: "test-results/endgames-size-ids.png" });
  });

  test("endgames-search-rook.png", async ({ page }) => {
    await openEndgames(page);
    await page.getByLabel("Search endgames").fill("rook");
    await expect(page.getByTestId("endgame-row").first()).toBeVisible();
    await page.screenshot({ path: "test-results/endgames-search-rook.png" });
  });

  test("endgames-position-unstarred.png and endgames-position-starred.png", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await page.getByTestId("endgame-row").first().click();
    await page.screenshot({ path: "test-results/endgames-position-unstarred.png" });

    await page.getByRole("button", { name: "Add to favorites" }).click();
    await page.screenshot({ path: "test-results/endgames-position-starred.png" });
  });

  test("endgames-favorites.png and endgames-favorites-dark.png", async ({ page }) => {
    await openEndgames(page);
    await openSize(page, /6 to 8 pieces/);
    await page.getByTestId("endgame-row").first().click();
    await page.getByRole("button", { name: "Add to favorites" }).click();
    await page.getByLabel("Back").click();
    await page.getByLabel("Back").click();
    await page.getByTestId("favorites-row").click();
    await page.screenshot({ path: "test-results/endgames-favorites.png" });

    await page.evaluate(() => localStorage.setItem("blindfoldTheme", "dark"));
    await page.reload();
    await waitForEngineReady(page);
    await page.getByRole("button", { name: /Practice an endgame/i }).click();
    await page.getByTestId("favorites-row").click();
    await page.screenshot({ path: "test-results/endgames-favorites-dark.png" });
  });

  test("endgames-favorites-empty.png", async ({ page }) => {
    await openEndgames(page);
    await page.getByTestId("favorites-row").click();
    await page.screenshot({ path: "test-results/endgames-favorites-empty.png" });
  });
});
