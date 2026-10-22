import { test, expect, type Page } from "@playwright/test";
import { openApp, waitForEngineReady, PHONE_USABLE } from "./helpers";

/**
 * Repro for the 2026-10-22 ~13:15 report: after a set-up K+B vs K game
 * declared "Insufficient material. Draw.", Ashish tapped the panel's main
 * button twice (each time starting a fresh normal game, since Part A's
 * change didn't exist yet), and during that the whole screen flickered very
 * fast. Rotating to landscape and back stopped it. These are his exact
 * steps, replayed against both the old build (to attempt a repro) and the
 * fixed one (as a standing guard).
 */
async function setUpInsufficientMaterial(page: Page) {
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByRole("button", { name: "white king", exact: true }).click();
  await page.getByLabel("square e1").click();
  await page.getByRole("button", { name: "white bishop", exact: true }).click();
  await page.getByLabel("square c1").click();
  await page.getByRole("button", { name: "black king", exact: true }).click();
  await page.getByLabel("square e8").click();
}

/**
 * Settles, then watches for 3s: a MutationObserver on the whole document
 * (subtree/attributes/childList/characterData) plus a per-frame sample of
 * the message log's clientHeight/scrollTop and document.body's bounding
 * box. A flickering screen is either repeatedly mutating the DOM or
 * repeatedly resizing/repositioning something -- this catches either. Pass
 * = at most 3 mutations (ordinary settling, e.g. a speech/engine status
 * update) and no sampled value ever changing.
 */
async function assertQuiet(page: Page, label: string) {
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    return new Promise<{ mutationCount: number; changed: string[] }>((resolve) => {
      let mutationCount = 0;
      const observer = new MutationObserver((records) => {
        mutationCount += records.length;
      });
      observer.observe(document.body, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });

      const log = document.querySelector('[data-testid="message-log"]') as HTMLElement | null;
      type Sample = { clientHeight: number; scrollTop: number; bx: number; by: number; bw: number; bh: number };
      const samples: Sample[] = [];
      const start = performance.now();

      function sample() {
        const body = document.body.getBoundingClientRect();
        samples.push({
          clientHeight: log?.clientHeight ?? -1,
          scrollTop: log?.scrollTop ?? -1,
          bx: body.x,
          by: body.y,
          bw: body.width,
          bh: body.height,
        });
        if (performance.now() - start < 3000) {
          requestAnimationFrame(sample);
        } else {
          observer.disconnect();
          const first = samples[0];
          const changed = (Object.keys(first) as (keyof Sample)[]).filter((key) =>
            samples.some((s) => s[key] !== first[key]),
          );
          resolve({ mutationCount, changed });
        }
      }
      requestAnimationFrame(sample);
    });
  });

  expect(
    result.mutationCount,
    `${label}: ${result.mutationCount} DOM mutations in 3s`,
  ).toBeLessThanOrEqual(3);
  expect(result.changed, `${label}: these kept changing every frame: ${result.changed.join(", ")}`).toEqual([]);
}

test("setting up the same draw twice and tapping the panel's main button each time does not flicker", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  if (testInfo.project.name === "iphone") await page.setViewportSize(PHONE_USABLE);

  await openApp(page);
  await waitForEngineReady(page);

  await page.getByRole("button", { name: /set up a position/i }).click();
  await assertQuiet(page, "after opening Set up a position (round 1)");

  await setUpInsufficientMaterial(page);
  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertQuiet(page, "after the draw panel appears (round 1)");

  // Current label on the panel's main button regardless of which build is
  // under test: "Edit position" (fixed) or "New Game" (old) -- either way
  // it's the first button in the panel.
  await page.getByRole("dialog").getByRole("button").first().click();
  await assertQuiet(page, "after tapping the panel's main button (round 1)");

  await page.getByLabel("Back to menu").click();
  const leaveConfirm = page.getByRole("dialog").filter({ hasText: "Leave this game?" });
  if (await leaveConfirm.isVisible().catch(() => false)) {
    await leaveConfirm.getByRole("button", { name: "Leave", exact: true }).click();
  }
  await assertQuiet(page, "back at the menu (round 1)");

  await page.getByRole("button", { name: /set up a position/i }).click();
  await assertQuiet(page, "after opening Set up a position (round 2)");

  await setUpInsufficientMaterial(page);
  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertQuiet(page, "after the draw panel appears (round 2)");

  await page.getByRole("dialog").getByRole("button").first().click();
  await assertQuiet(page, "after tapping the panel's main button (round 2)");
});
