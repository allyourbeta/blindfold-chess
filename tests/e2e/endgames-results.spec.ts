import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openApp, waitForEngineReady } from "./helpers";

// SPEC_buttons_results.md Part 2: the position screen's result line. Reads
// the real shipped catalog (src/data/endgames.json) to find one example of
// each kind, rather than hard-coding a position id that a catalog rebuild
// could retire or renumber.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
interface ShippedEntry {
  code: string;
  fen: string;
  result: { kind: "perfect" | "game"; score: string } | null;
}
const ENDGAMES = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../src/data/endgames.json"), "utf8"),
) as ShippedEntry[];

function pieceCount(fen: string): number {
  return fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
}

function bucketFor(pieces: number): RegExp {
  if (pieces <= 5) return /3 to 5 pieces/;
  if (pieces <= 8) return /6 to 8 pieces/;
  if (pieces <= 11) return /9 to 11 pieces/;
  return /12 to 16 pieces/;
}

const perfectEntry = ENDGAMES.find((e) => e.result?.kind === "perfect");
const gameEntry = ENDGAMES.find((e) => e.result?.kind === "game" && pieceCount(e.fen) >= 8);
const noneEntry = ENDGAMES.find((e) => e.result === null && pieceCount(e.fen) >= 8);

async function openEndgames(page: Page) {
  await openApp(page);
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /Practice an endgame/i }).click();
}

async function openSize(page: Page, name: RegExp) {
  await page.getByTestId("size-row").filter({ hasText: name }).click();
}

async function openByCode(page: Page, entry: ShippedEntry) {
  await openSize(page, bucketFor(pieceCount(entry.fen)));
  await page.getByTestId("endgame-row").filter({ hasText: entry.code }).click();
}

test("a 3-to-7-piece position shows 'Perfect play:' and its score", async ({ page }) => {
  expect(perfectEntry, "no perfect-play entry in the shipped catalog").toBeDefined();
  await openEndgames(page);
  await openByCode(page, perfectEntry!);
  await expect(page.getByText("Perfect play:")).toBeVisible();
});

test("an 8+-piece game position shows 'Game result:' and its score", async ({ page }) => {
  expect(gameEntry, "no game-result entry in the shipped catalog").toBeDefined();
  await openEndgames(page);
  await openByCode(page, gameEntry!);
  await expect(page.getByText("Game result:")).toBeVisible();
});

test("an 8+-piece position with no known result shows neither result line", async ({ page }) => {
  expect(noneEntry, "no no-result 8+-piece entry in the shipped catalog").toBeDefined();
  await openEndgames(page);
  await openByCode(page, noneEntry!);
  await expect(page.getByText("Perfect play:")).toHaveCount(0);
  await expect(page.getByText("Game result:")).toHaveCount(0);
});

// Part 5's screenshot set, for docs/targets/buttons-results.html.
test.describe("screenshots for visual comparison", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  test("endgames-position-perfect.png and endgames-position-perfect-dark.png", async ({ page }) => {
    await openEndgames(page);
    await openByCode(page, perfectEntry!);
    await page.screenshot({ path: "test-results/endgames-position-perfect.png" });

    await page.evaluate(() => localStorage.setItem("blindfoldTheme", "dark"));
    await page.reload();
    await waitForEngineReady(page);
    await page.getByRole("button", { name: /Practice an endgame/i }).click();
    await openByCode(page, perfectEntry!);
    await page.screenshot({ path: "test-results/endgames-position-perfect-dark.png" });
  });

  test("endgames-position-game.png", async ({ page }) => {
    await openEndgames(page);
    await openByCode(page, gameEntry!);
    await page.screenshot({ path: "test-results/endgames-position-game.png" });
  });

  test("endgames-position-none.png", async ({ page }) => {
    await openEndgames(page);
    await openByCode(page, noneEntry!);
    await page.screenshot({ path: "test-results/endgames-position-none.png" });
  });
});
