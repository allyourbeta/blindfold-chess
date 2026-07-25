import { test, expect } from "@playwright/test";
import { waitForEngineReady, submitMove } from "./helpers";

test("plays a full game offline after one online load", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15_000 });
  // Reload so the service worker actually controls this page (it never
  // controls the very first load that registered it), and give it a moment
  // to finish precaching the engine/audio assets.
  await page.reload();
  await waitForEngineReady(page);
  await page.waitForTimeout(2000);

  await context.setOffline(true);

  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(page.getByLabel("Your move")).toBeVisible();

  await submitMove(page, "e4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4 \S+/, { timeout: 15_000 });

  await page.getByLabel("Peek at the board").click();
  await expect(page.locator('[class*="bg-sq-"]')).toHaveCount(64);

  await page.getByRole("button", { name: /Takeback/ }).click();
  await expect(page.getByText("No moves yet")).toBeVisible();

  await context.setOffline(false);
});
