import { test, expect } from "@playwright/test";
import { startStandardGame, submitMove, leaveGame } from "./helpers";

declare global {
  interface Window {
    __speechStore?: { getState(): { isSpeaking: boolean } };
  }
}

/** Speech is on by default (see src/state/settingsStore.ts), so a real engine reply gets spoken without any extra setup. */
test("leaving a game mid-announcement cuts off the engine's spoken reply", async ({ page }) => {
  await startStandardGame(page);
  await submitMove(page, "e4");
  await expect(page.getByText("Engine speaking…")).toBeVisible({ timeout: 15_000 });

  await leaveGame(page);

  await expect
    .poll(() => page.evaluate(() => window.__speechStore!.getState().isSpeaking), { timeout: 300 })
    .toBe(false);
});
