import { test, expect } from "@playwright/test";
import { startStandardGame, waitForEngineReady, keypad, submitMove, tapKeypadKey, openApp } from "./helpers";

test("plays e4 by tapping e then 4", async ({ page }) => {
  await startStandardGame(page);
  await submitMove(page, "e4");
  await expect(page.getByText("White: e4")).toBeVisible();
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4/);
});

test("a knight ambiguity shows both SAN labels in the chooser, and tapping one plays it", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();

  // Knights on b3 and f3 both reach d2 — a genuine SAN disambiguation.
  await page.getByPlaceholder("Paste FEN string...").fill("4k3/8/8/8/8/1N3N2/8/4K3 w - - 0 1");
  await page.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await tapKeypadKey(page, "Knight");
  await tapKeypadKey(page, "d");
  await tapKeypadKey(page, "2");

  const nbd2 = keypad(page).getByRole("button", { name: "Nbd2", exact: true });
  const nfd2 = keypad(page).getByRole("button", { name: "Nfd2", exact: true });
  await expect(nbd2).toBeVisible();
  await expect(nfd2).toBeVisible();

  await nbd2.click();
  await expect(page.getByText("White: Nbd2")).toBeVisible();
});

/**
 * FALSIFIER: put the transient strip back to `h-8`, or the chooser back to
 * `size="sm"`, and this fails — the first on the fit assertion, the second
 * on the font-size one.
 *
 * Visibility was never the problem: the old chooser buttons were "visible"
 * and clickable while being clipped 6px top and bottom inside a 32px row and
 * labelled in 12px type. Only real geometry off the rendered element can
 * tell the difference, so that is what this reads.
 */
test("the move chooser is legible and fits inside its row", async ({ page }) => {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /set up a position/i }).click();
  await page.getByPlaceholder("Paste FEN string...").fill("4k3/8/8/8/8/1N3N2/8/4K3 w - - 0 1");
  await page.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();

  await tapKeypadKey(page, "Knight");
  await tapKeypadKey(page, "d");
  await tapKeypadKey(page, "2");
  await expect(keypad(page).getByRole("button", { name: "Nbd2", exact: true })).toBeVisible();

  const geometry = await page.evaluate(() => {
    const strip = document.querySelector('[data-testid="entry-strip"]')!;
    const button = strip.querySelector("button")!;
    const s = strip.getBoundingClientRect();
    const b = button.getBoundingClientRect();
    return {
      fontSize: parseFloat(getComputedStyle(button).fontSize),
      buttonHeight: b.height,
      overflowTop: s.top - b.top,
      overflowBottom: b.bottom - s.bottom,
    };
  });

  expect(geometry.fontSize).toBeGreaterThanOrEqual(16);
  expect(geometry.buttonHeight).toBeGreaterThanOrEqual(40);
  expect(geometry.overflowTop).toBeLessThanOrEqual(0.5);
  expect(geometry.overflowBottom).toBeLessThanOrEqual(0.5);
});

test("dims dual keys neither of whose readings can reach a legal move", async ({ page }) => {
  await startStandardGame(page);
  await tapKeypadKey(page, "Knight");
  // Neither reading of the e5 key works here: no knight reaches the e-file,
  // and no file has been chosen yet so ranks aren't accepted at all.
  await expect(keypad(page).getByRole("button", { name: "e5", exact: true })).toBeDisabled();
  // f6 stays live via its file reading — Nf3 runs through it.
  await expect(keypad(page).getByRole("button", { name: "f6", exact: true })).toBeEnabled();
});

test("desktop: a physical keyboard drives the same state machine", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "keyboard-driven entry is a desktop scenario");
  await startStandardGame(page);
  await page.keyboard.press("e");
  await page.keyboard.press("4");
  await expect(page.getByText("White: e4")).toBeVisible();
});

test("mobile: the keypad renders and no text input or mic pad exists", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone", "checks the mobile viewport specifically");
  await startStandardGame(page);
  await expect(keypad(page)).toBeVisible();
  await expect(page.getByLabel("Your move")).toHaveCount(0);
  await expect(page.getByLabel(/Start listening|Stop listening/)).toHaveCount(0);
});
