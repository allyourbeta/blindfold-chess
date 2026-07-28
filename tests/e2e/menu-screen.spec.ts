import { expect, test } from "@playwright/test";
import { waitForEngineReady, openApp } from "./helpers";

test("home screen leads with the game and keeps settings out of the way", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);

  await expect(page.getByRole("heading", { name: "Mind's Eye" })).toBeVisible();
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

  // The opponent's name lives on the play screen's status line; repeating it
  // here was redundant. Falsifier: goes red if it comes back to the menu.
  await expect(page.getByText("Maia 1900", { exact: true })).toHaveCount(0);

  // Three chips replace the old summary sentence and its disclosure row.
  for (const chip of ["Color", "Variance", "Speech"]) {
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
