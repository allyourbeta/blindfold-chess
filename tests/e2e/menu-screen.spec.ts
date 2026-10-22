import { expect, test } from "@playwright/test";
import { waitForEngineReady, openApp, PHONE_USABLE } from "./helpers";

test("home screen leads with the game and keeps settings out of the way", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);

  await expect(page.getByRole("heading", { name: "Blindfolde", exact: true })).toBeVisible();
  await expect(page.getByText("The ultimate test of cerebral fitness")).toBeVisible();
  // toBeVisible() alone passes for a broken <img> too — it has fixed width/
  // height classes, so its box is non-empty even at 404. Assert it actually
  // decoded a real image.
  const logo = page.locator('img[src="/icons/icon-512.png"]');
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 10_000 })
    .toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();

  // The Opponent chip now surfaces this by design
  // (SPEC_log_opponent_style.md Part B) -- it shows the opponent's name
  // right on the menu, same place Color and Speech live.
  await expect(page.getByText("Maia 1900", { exact: true })).toBeVisible();

  // Four chips replace the old summary sentence and its disclosure row.
  for (const chip of ["Color", "Opponent", "Variance", "Speech"]) {
    await expect(page.getByRole("button", { name: new RegExp(chip) })).toBeVisible();
  }

  // Detailed controls stay collapsed until asked for.
  await expect(page.getByRole("button", { name: "Wild", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Variance/ }).click();
  await expect(page.getByRole("button", { name: "Wild", exact: true })).toBeVisible();
});

test("the how-to-play guide is gone", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);

  await expect(page.getByRole("button", { name: "How to play" })).toHaveCount(0);
  await expect(page.getByText("Tap moves on the keypad")).toHaveCount(0);
});

test("the theme toggle is tappable across its whole button, not just a sliver at the top", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "iphone") await page.setViewportSize(PHONE_USABLE);

  await openApp(page);
  await waitForEngineReady(page);

  const toggle = page.getByRole("button", { name: "Toggle dark mode" });
  await expect(toggle).toBeVisible();
  const box = await toggle.boundingBox();
  if (!box) throw new Error("toggle has no bounding box");

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const nearBottomY = box.y + box.height - 8;

  const elementAtCenter = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('button[aria-label="Toggle dark mode"]') !== null,
    [centerX, centerY],
  );
  expect(elementAtCenter, "center point should hit the toggle").toBe(true);

  const elementNearBottom = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('button[aria-label="Toggle dark mode"]') !== null,
    [centerX, nearBottomY],
  );
  expect(elementNearBottom, "point 8px above the toggle's bottom edge should hit the toggle").toBe(true);

  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.mouse.click(centerX, centerY);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.mouse.click(centerX, centerY);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
