import { expect, test } from "@playwright/test";
import { startStandardGame, waitForEngineReady, openApp } from "./helpers";

test("the app is titled Blindfolde: tab title and manifest", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);

  await expect(page).toHaveTitle("Blindfolde");

  const manifest = await page.evaluate(async () => {
    const res = await fetch("/manifest.json");
    return res.json();
  });
  expect(manifest.name).toBe("Blindfolde");
  expect(manifest.short_name).toBe("Blindfolde");
});

test("game header reads BLINDFOLDE and stays inside the viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone", "iphone-only viewport check");
  await startStandardGame(page);

  const header = page.getByText("BLINDFOLDE", { exact: true });
  await expect(header).toBeVisible();
  const headerBox = await header.boundingBox();
  const viewport = page.viewportSize();
  expect(headerBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(viewport!.width);
});
