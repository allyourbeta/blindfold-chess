import { expect, type Page } from "@playwright/test";
import { keypad } from "./helpers";
import type { RunFn } from "./auditWalkSteps";

// State 5 of SPEC_full_app_audit.md Part 2: Endgame Lab. Split out of
// auditWalkSteps.ts purely for the 300-line file rule.

async function openSize(page: Page, name: RegExp) {
  await page.getByTestId("size-row").filter({ hasText: name }).click();
}

export async function walkEndgameLab(page: Page, run: RunFn): Promise<void> {
  await page.getByRole("button", { name: /Endgame Lab/i }).click();
  await run("lab: home");

  const search = page.getByLabel("Search endgames");
  await search.fill("rook");
  await expect(page.getByTestId("endgame-row").first()).toBeVisible();
  await run("lab: search results");

  await search.fill("zzzzzzz");
  await expect(page.getByText(/No endgames match/)).toBeVisible();
  await run("lab: search no results");

  await page.getByRole("button", { name: "Clear search" }).click();

  await page.getByTestId("favorites-row").click();
  await run("lab: favorites (empty)");
  await page.getByLabel("Back").click();

  await openSize(page, /3 to 5 pieces/);
  await run("lab: size list");

  await page.getByTestId("endgame-row").first().click();
  await expect(page.getByText(/^(White|Black) to move$/)).toBeVisible();
  await run("lab: a position");

  await page.getByRole("button", { name: "Add to favorites" }).click();
  await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
  await run("lab: position starred");

  await page.getByLabel("Back").click();
  await page.getByLabel("Back").click();
  await page.getByTestId("favorites-row").click();
  await run("lab: favorites (with one item)");

  await page.getByTestId("endgame-row").first().click();
  await run("lab: a position (opened from favorites)");

  await page.getByRole("button", { name: "Next" }).click();
  await run("lab: Next (another of this size)");

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();
  await run("lab-play: started");

  await page.getByRole("button", { name: "Resign" }).click();
  await run("lab-play: resign confirm open");
  await page
    .getByRole("dialog")
    .filter({ hasText: "Resign this game?" })
    .getByRole("button", { name: "Resign", exact: true })
    .click();
  await run("lab-play: endgame results panel");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Endgames" })).toBeVisible();

  await dialog.getByRole("button", { name: "Next" }).click();
  await run("lab-play: Next from the results panel");

  await page.getByRole("button", { name: "Resign" }).click();
  await page
    .getByRole("dialog")
    .filter({ hasText: "Resign this game?" })
    .getByRole("button", { name: "Resign", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Endgames" }).click();

  await page.getByTestId("endgame-row").first().click();
  await page.getByRole("button", { name: "Edit" }).click();
  await run("lab: Edit -> setup shows the lab position");

  await page.getByRole("button", { name: "Back to menu" }).click();
}
