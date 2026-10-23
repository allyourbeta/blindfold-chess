import { test, expect } from "@playwright/test";
import { openApp } from "./helpers";

// SPEC_last_quirks_and_mute.md Part A -- guards the thing Ashish actually
// hears: nothing on this run should make a sound. `--mute-audio`
// (playwright.config.ts) covers Chromium only, so this exercises the
// webkit-compatible fallback, muteAudio() in helpers.ts, directly.

test("a new Audio().play() stays muted", async ({ page }) => {
  await openApp(page);
  const muted = await page.evaluate(() => {
    const audio = new Audio();
    // Don't await: with no <source>, play() can reject OR (observed with
    // --mute-audio) simply never settle. The wrapper sets `muted` BEFORE
    // calling the original play(), synchronously -- that's what this test
    // checks, not whether playback itself ever starts.
    audio.play().catch(() => {});
    return audio.muted;
  });
  expect(muted).toBe(true);
});

test("a spoken utterance has volume 0 at speak time", async ({ page }) => {
  await openApp(page);
  const volume = await page.evaluate(() => {
    const utterance = new SpeechSynthesisUtterance("test");
    window.speechSynthesis.speak(utterance);
    return utterance.volume;
  });
  expect(volume).toBe(0);
});
