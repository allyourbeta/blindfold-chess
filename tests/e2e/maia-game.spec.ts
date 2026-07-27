import { test, expect } from "@playwright/test";
import { openApp, waitForEngineReady, submitMove, keypad } from "./helpers";

/**
 * A real, multi-move game against the actual model (no mocking) with
 * "Predictable" set so Maia's replies are a true argmax -- deterministic
 * given the same moves, unlike every other randomness stop. That makes this
 * a genuine regression test, not just a smoke test: if the model, the
 * encoding, or the history-planes feed ever changed in a way that altered
 * what the network actually computes, Maia's replies here would change too.
 * This exact sequence was captured by playing it against the real model
 * (see SPEC_maia_integrate.md's report) -- if it ever needs updating, do
 * that by re-playing the game, not by guessing.
 */
test("a full game against Maia is deterministic under Predictable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("blindfoldRandomness", "predictable");
  });
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();

  const playerMoves = ["e4", "Nf3", "Bc4", "d3", "c3", "Qb3"];
  for (const move of playerMoves) {
    await submitMove(page, move);
  }

  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(
    "1. e4 c5  2. Nf3 d6  3. Bc4 e6  4. d3 Nf6  5. c3 Be7  6. Qb3 a6",
    { timeout: 15_000 },
  );
  await expect(page.getByText(/error/i)).toHaveCount(0);
  await expect(page.getByText(/Your move ·/)).toBeVisible();
});
