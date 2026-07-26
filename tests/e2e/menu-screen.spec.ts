import { expect, test } from "@playwright/test";
import { waitForEngineReady } from "./helpers";

test("home screen prioritizes starting a game and progressively reveals details", async ({ page }) => {
  await page.goto("/");
  await waitForEngineReady(page);

  await expect(page.getByRole("heading", { name: "Mind's Eye" })).toBeVisible();
  await expect(page.getByText("See the board in your mind.")).toBeVisible();
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change settings" })).toBeVisible();

  // Detailed controls and the notation guide should not compete with the main
  // action until the player asks for them.
  await expect(page.getByRole("button", { name: "Full Strength", exact: true })).toHaveCount(0);
  await expect(page.getByText("Type or speak moves in standard algebraic notation.")).toHaveCount(0);

  await page.getByRole("button", { name: "Change settings" }).click();
  await expect(page.getByRole("button", { name: "Full Strength", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByText("Type or speak moves in standard algebraic notation.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Full Strength", exact: true })).toHaveCount(0);
});
