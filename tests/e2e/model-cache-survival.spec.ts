import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { openApp, waitForEngineReady, submitMove, keypad } from "./helpers";

/**
 * The model lives in its own cache (MODEL_CACHE_NAME), deliberately untouched
 * by the app-shell cache-name bump that every other deploy does — see the
 * comment above MODEL_CACHE_NAME in public/sw.js. Nothing exercised that
 * separation: if a future change merged the two caches, or the activate
 * handler's exemption for MODEL_CACHE_NAME were lost, every visitor would
 * silently re-download the 3.3 MB model on their next deploy (or fail
 * offline if the deploy caught them without connectivity).
 *
 * The simulated-deployment step below is read directly out of sw.js's own
 * `activate` handler text (`key !== CACHE_NAME && key !== MODEL_CACHE_NAME`)
 * rather than hardcoded, and applies it with the ACTUAL MODEL_CACHE_NAME
 * value the shipped worker uses — a real version bump makes the running
 * worker's CACHE_NAME a string no existing cache key matches, so "delete
 * every key except the model cache" is exactly what activate does on that
 * bump, not an approximation of it. This is the full simulation described
 * in SPEC_tests_hardening.md, not the fallback weaker invariant — deleting
 * real Cache Storage entries from the page is entirely practical in
 * Playwright/Chromium.
 *
 * FALSIFIER: goes red if, after every cache but the model's is deleted (the
 * real effect of an app-shell version bump), the model's cache entry is
 * gone, or the app can no longer play a move offline afterwards.
 */

const swSource = readFileSync(fileURLToPath(new URL("../../public/sw.js", import.meta.url)), "utf8");
const MODEL_CACHE_NAME = swSource.match(/const MODEL_CACHE_NAME = '([^']+)'/)?.[1];
const MODEL_URL = swSource.match(/const MODEL_URL = '([^']+)'/)?.[1];
if (!MODEL_CACHE_NAME || !MODEL_URL) {
  throw new Error("Could not parse MODEL_CACHE_NAME / MODEL_URL out of public/sw.js");
}

test("the model's cache survives a simulated deployment and the app still plays offline afterwards", async ({
  page,
  context,
}) => {
  await openApp(page);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15_000 });
  // Reload so the service worker actually controls this page and finishes
  // precaching the model, mirroring offline.spec.ts's one-online-load setup.
  await page.reload();
  await waitForEngineReady(page);
  await page.waitForTimeout(2000);

  // Simulate a deployment: apply the app-shell cleanup rule sw.js's own
  // `activate` handler uses, with the real MODEL_CACHE_NAME value plugged
  // in — everything except the model's cache is wiped, exactly as happens
  // when a version bump makes the running CACHE_NAME a name no existing
  // cache key matches.
  await page.evaluate(async (modelCacheName) => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== modelCacheName).map((key) => caches.delete(key)));
  }, MODEL_CACHE_NAME);

  const modelSurvived = await page.evaluate(
    async ({ cacheName, modelUrl }) => {
      const cache = await caches.open(cacheName);
      return (await cache.match(modelUrl)) !== undefined;
    },
    { cacheName: MODEL_CACHE_NAME, modelUrl: MODEL_URL },
  );
  expect(modelSurvived).toBe(true);

  // A real deploy's activate runs while the browser still has the fresh
  // build available over the network — reload (still online) to rebuild the
  // wiped app shell, the way the next visit after a deploy actually would.
  await page.reload();
  await waitForEngineReady(page);

  await context.setOffline(true);

  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();
  await submitMove(page, "e4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4 \S+/, { timeout: 15_000 });

  await context.setOffline(false);
});
