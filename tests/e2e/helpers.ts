import { expect, type Page } from "@playwright/test";

export async function waitForEngineReady(page: Page) {
  await expect(page.getByRole("button", { name: /New Game/ })).toBeVisible({
    timeout: 20_000,
  });
}

export async function startStandardGame(page: Page) {
  await page.goto("/");
  await waitForEngineReady(page);
  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(page.getByLabel("Your move")).toBeVisible();
}

/** Selects a skill level by its label on the menu screen before starting — use "Full Strength" for tests that need a slow, reliably in-flight search. */
export async function startGameAtSkill(page: Page, skillLabel: string) {
  await page.goto("/");
  await waitForEngineReady(page);
  await page.getByRole("button", { name: skillLabel, exact: true }).click();
  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(page.getByLabel("Your move")).toBeVisible();
}

export async function submitMove(page: Page, text: string) {
  const input = page.getByLabel("Your move");
  await input.fill(text);
  await input.press("Enter");
}
