import { test, expect, type Page } from "@playwright/test";

// SPEC_pos_page_and_remove.md Part 4 -- the password-protected Remove
// button. The real api/positions/* functions don't run against the local
// preview server, so every scenario route-mocks them.

async function openAppAt(page: Page, path: string) {
  await page.addInitScript(() => {
    localStorage.setItem("blindfoldShowTicker", "true");
    localStorage.setItem("blindfoldAssistMode", "assisted");
  });
  await page.goto(path);
}

async function openEndgames(page: Page) {
  await expect(page.getByRole("button", { name: /New Game/ })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: /Practice an endgame/i }).click();
}

async function openFirstPosition(page: Page) {
  await page.getByTestId("size-row").filter({ hasText: /6 or more pieces/ }).click();
  await page.getByTestId("endgame-row").first().click();
}

/**
 * Visits `#creator` and answers the password prompt. On a wrong password,
 * chains a second one-shot handler for the "Wrong password" alert that
 * follows it -- each handler only ever sees its own dialog, never both.
 */
async function unlock(page: Page, password: string, expectAccepted: boolean) {
  await page.route("**/api/positions/verify", (route) =>
    route.fulfill({ status: expectAccepted ? 200 : 401, body: "{}" }),
  );
  let alertMessage = "";
  page.once("dialog", (dialog) => {
    void dialog.accept(password);
    if (!expectAccepted) {
      page.once("dialog", (alertDialog) => {
        alertMessage = alertDialog.message();
        void alertDialog.accept();
      });
    }
  });
  await openAppAt(page, "/#creator");
  if (!expectAccepted) await expect.poll(() => alertMessage).toMatch(/Wrong password/);
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
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: /Practice an endgame/i }).click();
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
