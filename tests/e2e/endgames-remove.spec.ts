import { test, expect, type Page } from "@playwright/test";
import { openAppAt, unlock } from "./helpers";

// SPEC_pos_page_and_remove.md Part 4 -- the password-protected Remove
// button. The real api/positions/* functions don't run against the local
// preview server, so every scenario route-mocks them.

async function openEndgames(page: Page) {
  await expect(page.getByRole("button", { name: /New Game/ })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: /Endgame Lab/i }).click();
}

async function openFirstPosition(page: Page) {
  await page.getByTestId("size-row").filter({ hasText: /6 or more pieces/ }).click();
  await page.getByTestId("endgame-row").first().click();
}

test("no Remove button on the position screen or the game-over panel while locked", async ({ page }) => {
  await openAppAt(page, "/");
  await openEndgames(page);
  await openFirstPosition(page);
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(page.getByRole("group", { name: "Move entry keypad" })).toBeVisible();
  await page.getByRole("button", { name: /Resign/ }).click();
  await page
    .getByRole("dialog")
    .filter({ hasText: "Resign this game?" })
    .getByRole("button", { name: "Resign", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
});

test("#creator with the wrong password shows an error and stays locked", async ({ page }) => {
  await unlock(page, "wrong", false);

  await openEndgames(page);
  await openFirstPosition(page);
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
});

test("#creator with the right password unlocks Remove", async ({ page }) => {
  await unlock(page, "hunter2", true);

  await openEndgames(page);
  await openFirstPosition(page);
  const removeButton = page.getByRole("button", { name: "Remove", exact: true });
  await expect(removeButton).toBeVisible();

  // Compact, not full width -- the point of SPEC_button_text_and_remove.md.
  await page.setViewportSize({ width: 390, height: 844 });
  const removeBox = await removeButton.boundingBox();
  const containerBox = await page.getByTestId("endgame-scroll").boundingBox();
  expect(removeBox!.width).toBeLessThan(containerBox!.width / 2);
});

test("Remove on the position screen: confirm, the position disappears from the list, and the note shows", async ({
  page,
}) => {
  await unlock(page, "hunter2", true);
  await openEndgames(page);
  await openFirstPosition(page);

  const title = await page.getByTestId("endgame-scroll").locator("p.text-xl").first().textContent();
  const code = title!.trim().split(/\s+/)[0];

  await page.route("**/api/positions/remove", (route) => route.fulfill({ status: 200, body: "{}" }));
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove", exact: true }).click();

  await expect(page.getByText(/will be gone everywhere in about a minute/)).toBeVisible();
  await expect(page.getByTestId("endgame-row").filter({ hasText: code })).toHaveCount(0);

  // Persists across a reload too -- proves it was actually written to
  // storage, not just held in memory.
  await page.reload();
  await expect(page.getByRole("button", { name: /New Game/ })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: /Endgame Lab/i }).click();
  await page.getByTestId("size-row").filter({ hasText: /6 or more pieces/ }).click();
  await expect(page.getByTestId("endgame-row").filter({ hasText: code })).toHaveCount(0);
});

test("a failed Remove leaves the position in place and shows the server's message", async ({ page }) => {
  await unlock(page, "hunter2", true);
  await openEndgames(page);
  await openFirstPosition(page);

  await page.route("**/api/positions/remove", (route) =>
    route.fulfill({ status: 401, body: JSON.stringify({ error: "wrong password" }) }),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove", exact: true }).click();

  await expect(page.getByText("wrong password")).toBeVisible();
  // Still on the position screen, with Remove still available to retry.
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeVisible();
});
