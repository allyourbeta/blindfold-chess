import { test, expect } from "@playwright/test";
import { keypad, startStandardGame, submitMove, tapKeypadKey } from "./helpers";

// A phone on its side. No new Playwright project — just this viewport, so
// the landscape layout is covered without doubling every other suite's run.
test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

test("landscape: keypad and action buttons are both fully on screen", async ({ page }) => {
  await startStandardGame(page);

  const pad = keypad(page);
  await expect(pad).toBeVisible();

  // Geometry dump: if this test fails, the console shows exactly which block
  // is eating the height, rather than leaving it to arithmetic.
  const probes: [string, ReturnType<typeof page.getByRole>][] = [
    ["header", page.getByText("MIND'S EYE")],
    ["status", page.getByText(/Your move ·/)],
    ["ticker", page.getByRole("button", { name: /Move list/ })],
    ["actionbar", page.getByRole("button", { name: /New Game/ })],
    ["keypad", pad],
  ];
  for (const [label, locator] of probes) {
    const b = await locator.boundingBox();
    console.log(`[landscape] ${label}: y=${b?.y.toFixed(0)} h=${b?.height.toFixed(0)} bottom=${((b?.y ?? 0) + (b?.height ?? 0)).toFixed(0)}`);
  }

  // Every square key must sit inside the viewport — the portrait stack
  // overflowed here, which is the bug this layout fixes.
  for (const name of ["a1", "d4", "e5", "h8"]) {
    const box = await pad.getByRole("button", { name, exact: true }).boundingBox();
    expect(box, `${name} key has no box`).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(390);
  }

  // The action buttons live in the other column, also fully visible.
  for (const name of [/New Game/, /Resign/]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(390);
  }
});

test("landscape: a move can actually be played", async ({ page }) => {
  await startStandardGame(page);

  await tapKeypadKey(page, "Pawn");
  await submitMove(page, "e4");
  // Assert via the message log, not the ticker: startStandardGame seeds the
  // ticker VISIBLE, so tapping the row would hide the very text we want.
  await expect(page.getByText("White: e4")).toBeVisible();
});

test("landscape: the keypad sits beside the message log, not below it", async ({ page }) => {
  await startStandardGame(page);

  const padBox = await keypad(page).boundingBox();
  const logBox = await page.getByRole("button", { name: /Move list/ }).boundingBox();
  expect(padBox).not.toBeNull();
  expect(logBox).not.toBeNull();
  // Two columns: the keypad starts to the right of where the log ends.
  expect(padBox!.x).toBeGreaterThanOrEqual(logBox!.x + logBox!.width - 1);
});
