import { test, expect } from "@playwright/test";
import { Chess } from "chess.js";
import { waitForEngineReady, submitMove, keypad, openApp, tapMoreAction } from "./helpers";

test("plays a full game offline after one online load", async ({ page, context }) => {
  await openApp(page);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15_000 });
  // Reload so the service worker actually controls this page (it never
  // controls the very first load that registered it), and give it a moment
  // to finish precaching the engine/audio assets.
  await page.reload();
  await waitForEngineReady(page);
  await page.waitForTimeout(2000);

  await context.setOffline(true);

  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();

  await submitMove(page, "e4");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4 \S+/, { timeout: 15_000 });

  await page.getByLabel("Peek at the board").click();
  await expect(page.locator('[class*="bg-sq-"]')).toHaveCount(64);

  await page.getByRole("button", { name: /Takeback/ }).click();
  await expect(page.getByText("No moves yet")).toBeVisible();

  await context.setOffline(false);
});

// The catalog is a statically-imported JSON file, so it ships inside the
// same cached main bundle as everything else above -- no service-worker
// change was needed for this mode to work offline too.
test("plays an endgame offline after one online load", async ({ page, context }) => {
  await openApp(page);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15_000 });
  await page.reload();
  await waitForEngineReady(page);
  await page.waitForTimeout(2000);

  await context.setOffline(true);

  await page.getByRole("button", { name: /Practice an endgame/i }).click();
  await page.getByTestId("size-row").filter({ hasText: /3 to 5 pieces/ }).click();
  await page.getByTestId("endgame-row").first().click();
  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await tapMoreAction(page, /FEN/);
  const fen = ((await page.getByText(/^\S+ [wb] /).last().textContent()) ?? "").trim();
  await page.getByRole("button", { name: "Close more actions" }).click();

  // A move that doesn't itself end the game, so the engine's offline reply is observable.
  const chess = new Chess(fen);
  let move = chess.moves()[0];
  for (const san of chess.moves()) {
    const probe = new Chess(fen);
    probe.move(san);
    if (!probe.isGameOver()) {
      move = san;
      break;
    }
  }

  await submitMove(page, move);
  await expect(page.getByText(`: ${move}`)).toBeVisible();
  await expect(page.getByText(/^(White|Black): /)).toHaveCount(2, { timeout: 15_000 });

  await context.setOffline(false);
});
