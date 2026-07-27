import { test, expect, type Page } from "@playwright/test";
import { keypad, startStandardGame, submitMove, tapKeypadKey } from "./helpers";

// A phone on its side. No new Playwright project — just this viewport, so
// the landscape layout is covered without doubling every other suite's run.
const W = 844;
const H = 390;
test.use({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });

/**
 * The previous version of this file checked four keys' bottom edges and
 * passed while the real screen had controls clipped off the bottom AND the
 * action bar sitting on top of the keypad. These check what actually
 * matters: nothing leaves the viewport, and nothing overlaps anything.
 */
async function boxesOf(page: Page) {
  return page.evaluate(() => {
    const out: { label: string; x: number; y: number; w: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll("button"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const label = (el.getAttribute("aria-label") || el.textContent || "?").trim().slice(0, 24);
      out.push({ label, x: r.x, y: r.y, w: r.width, h: r.height });
    }
    return out;
  });
}

test("landscape: every control is fully inside the viewport", async ({ page }) => {
  await startStandardGame(page);
  await expect(keypad(page)).toBeVisible();

  // Always written, pass or fail: test-results/landscape.png. Numbers can
  // say "nothing overlaps" while the screen still looks wrong — a picture
  // is the only check that catches "this is ugly".
  await page.screenshot({ path: "test-results/landscape.png" });

  const boxes = await boxesOf(page);
  expect(boxes.length).toBeGreaterThan(10);

  const escaped = boxes.filter((b) => b.y + b.h > H + 0.5 || b.x + b.w > W + 0.5 || b.x < -0.5 || b.y < -0.5);
  expect(
    escaped.map((b) => `${b.label} @ ${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.w.toFixed(0)}x${b.h.toFixed(0)}`),
  ).toEqual([]);
});

test("landscape: no control overlaps another", async ({ page }) => {
  await startStandardGame(page);
  await expect(keypad(page)).toBeVisible();

  const boxes = await boxesOf(page);
  const collisions: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      // 1px tolerance: adjacent controls may share a rounded edge.
      if (overlapX > 1 && overlapY > 1) collisions.push(`${a.label} x ${b.label}`);
    }
  }
  expect(collisions).toEqual([]);
});

test("landscape: keys stay full size — the layout uses the width, it doesn't shrink", async ({ page }) => {
  await startStandardGame(page);

  const box = await keypad(page).getByRole("button", { name: "a1", exact: true }).boundingBox();
  expect(box).not.toBeNull();
  // Same height as portrait (h-16 = 64px). Landscape buys width, not smaller keys.
  expect(box!.height).toBeGreaterThanOrEqual(60);
  expect(box!.width).toBeGreaterThanOrEqual(60);
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
  expect(padBox!.x).toBeGreaterThanOrEqual(logBox!.x + logBox!.width - 1);
});
