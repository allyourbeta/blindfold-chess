import { test, expect, type Page } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { waitForEngineReady, resignGame, submitMove, keypad, PHONE_USABLE } from "./helpers";

// SPEC_raised_controls.md: one raised-control construction (top-light
// gradient + 1px border + 2px darker bottom edge + faint shadow) for every
// button in the app. A control that genuinely can't carry it is marked
// data-flat with one of a fixed set of reasons, enforced below.
const ALLOWED_FLAT = ["square", "card", "icon", "ticker"];

async function openAppWithTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t: string) => {
    localStorage.setItem("blindfoldShowTicker", "true");
    localStorage.setItem("blindfoldAssistMode", "assisted");
    localStorage.setItem("blindfoldTheme", t);
  }, theme);
  await page.goto("/");
}

/** Every visible <button> that is neither raised nor validly data-flat. */
async function raisedOffenders(page: Page, allowed: string[]): Promise<string[]> {
  return page.evaluate((allowedFlat) => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("button"))) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;

      const flat = el.getAttribute("data-flat");
      const name = (el.getAttribute("aria-label") || el.textContent || "?").trim().slice(0, 30);
      if (flat !== null) {
        if (!allowedFlat.includes(flat)) out.push(`bad data-flat="${flat}": ${name}`);
        continue;
      }

      const cs = getComputedStyle(el);
      const hasGradient = cs.backgroundImage.includes("gradient");
      const bottomEdge = Math.abs(parseFloat(cs.borderBottomWidth) - 2) < 0.5;
      if (hasGradient && bottomEdge) continue;
      out.push(`${name} (${el.className})`);
    }
    return out;
  }, allowed);
}

async function assertAllRaised(page: Page, screen: string) {
  const offenders = await raisedOffenders(page, ALLOWED_FLAT);
  expect(offenders, `${screen}: ${offenders.length} offender(s)\n${offenders.map((o) => `  ${screen}: ${o}`).join("\n")}`).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`raised controls — ${theme}`, () => {
    test.use({ viewport: PHONE_USABLE });

    test("menu, settings open", async ({ page }) => {
      await openAppWithTheme(page, theme);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /Color/ }).click();
      await expect(page.getByText("Game settings")).toBeVisible();
      await assertAllRaised(page, `menu (${theme})`);
    });

    test("setup screen", async ({ page }) => {
      await openAppWithTheme(page, theme);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /set up a position/i }).click();
      await assertAllRaised(page, `setup (${theme})`);
    });

    test("play screen, after a move, More menu open", async ({ page }) => {
      await openAppWithTheme(page, theme);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /New Game/ }).click();
      await expect(keypad(page)).toBeVisible();
      await submitMove(page, "e4");
      await page.getByRole("button", { name: /More/ }).click();
      await expect(page.getByRole("dialog", { name: "More actions" })).toBeVisible();
      await assertAllRaised(page, `play + More menu (${theme})`);
    });

    test("game-over panel, after resign", async ({ page }) => {
      await openAppWithTheme(page, theme);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /New Game/ }).click();
      await expect(keypad(page)).toBeVisible();
      await resignGame(page);
      await expect(page.getByRole("dialog").getByRole("paragraph")).toBeVisible();
      await assertAllRaised(page, `game-over panel (${theme})`);
    });

    test("lab home", async ({ page }) => {
      await openAppWithTheme(page, theme);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /Endgame Lab/i }).click();
      await assertAllRaised(page, `lab home (${theme})`);
    });

    test("a size list", async ({ page }) => {
      await openAppWithTheme(page, theme);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /Endgame Lab/i }).click();
      await page.getByTestId("size-row").first().click();
      await assertAllRaised(page, `size list (${theme})`);
    });

    test("a position", async ({ page }) => {
      await openAppWithTheme(page, theme);
      await waitForEngineReady(page);
      await page.getByRole("button", { name: /Endgame Lab/i }).click();
      await page.getByTestId("size-row").first().click();
      await page.getByTestId("endgame-row").first().click();
      await assertAllRaised(page, `position (${theme})`);
    });
  });
}

// ---------------------------------------------------------------------------
// Mechanical greps (checklist rule 11): the rule itself becomes a test, not
// just the runtime check above.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(__dirname, "..", "..", "src");

function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "maia-spike") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listTsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

test.describe("mechanical checks", () => {
  test("no <button> in src (outside maia-spike) carries rounded-2xl", () => {
    const offenders: string[] = [];
    for (const file of listTsxFiles(SRC_ROOT)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/<button\b[\s\S]*?>/g)) {
        if (match[0].includes("rounded-2xl")) offenders.push(`${file}: ${match[0].replace(/\s+/g, " ").slice(0, 100)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("SegmentedControl.tsx contains no bg-bg-surface", () => {
    const text = readFileSync(join(SRC_ROOT, "components", "ui", "SegmentedControl.tsx"), "utf8");
    expect(text).not.toContain("bg-bg-surface");
  });
});
