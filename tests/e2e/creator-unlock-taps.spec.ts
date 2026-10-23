import { test, expect, type Page } from "@playwright/test";
import { openApp } from "./helpers";

// SPEC_final_polish.md Part 4 -- tapping the menu's build line 5 times
// within 3 seconds opens the same password prompt #creator does. Stubs
// window.prompt so taps can be counted without a real dialog blocking the
// page (Playwright's dialog API can't tell "no dialog appeared" from "one
// is about to").

async function stubPrompt(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __promptCalls: number }).__promptCalls = 0;
    window.prompt = (..._args: unknown[]) => {
      (window as unknown as { __promptCalls: number }).__promptCalls += 1;
      return null;
    };
  });
}

function promptCalls(page: Page) {
  return page.evaluate(() => (window as unknown as { __promptCalls: number }).__promptCalls);
}

function buildLine(page: Page) {
  return page.getByRole("button", { name: /^build / });
}

test("tapping the build line 4 times does not open the password prompt", async ({ page }) => {
  await stubPrompt(page);
  await openApp(page);
  const line = buildLine(page);
  for (let i = 0; i < 4; i++) await line.click();
  expect(await promptCalls(page)).toBe(0);
});

test("tapping the build line 5 times quickly opens the password prompt once", async ({ page }) => {
  await stubPrompt(page);
  await openApp(page);
  const line = buildLine(page);
  for (let i = 0; i < 5; i++) await line.click();
  expect(await promptCalls(page)).toBe(1);
});

test("tapping the build line 5 times spread over 4 seconds does not open the prompt", async ({ page }) => {
  await stubPrompt(page);
  await openApp(page);
  const line = buildLine(page);
  for (let i = 0; i < 5; i++) {
    await line.click();
    if (i < 4) await page.waitForTimeout(1000);
  }
  expect(await promptCalls(page)).toBe(0);
});

test("#creator still opens the password prompt directly", async ({ page }) => {
  await stubPrompt(page);
  await openApp(page);
  await page.evaluate(() => {
    window.location.hash = "#creator";
  });
  await expect.poll(() => promptCalls(page)).toBe(1);
});
