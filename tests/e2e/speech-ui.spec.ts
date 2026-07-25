import { test, expect } from "@playwright/test";
import { startStandardGame } from "./helpers";

test("microphone control renders when speech recognition is available", async ({ page }) => {
  await startStandardGame(page);
  // Headless Chromium exposes webkitSpeechRecognition, so continuous mode should be active.
  await expect(page.getByLabel(/Start listening|Stop listening/)).toBeVisible();
  await expect(page.getByText(/Voice input isn't available/)).toHaveCount(0);
});

test("microphone control is hidden and typed play still works when speech recognition is absent", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // @ts-expect-error — simulating a browser without the Web Speech API
    delete window.SpeechRecognition;
    // @ts-expect-error — same
    delete window.webkitSpeechRecognition;
  });

  await startStandardGame(page);

  await expect(page.getByLabel(/Start listening|Stop listening/)).toHaveCount(0);
  await expect(page.getByText(/Voice input isn't available in this browser/)).toBeVisible();

  // Typed play must remain fully functional.
  const input = page.getByLabel("Your move");
  await input.fill("e4");
  await input.press("Enter");
  await expect(page.locator("div.font-mono.text-sm").first()).toHaveText(/^1\. e4/);
});
