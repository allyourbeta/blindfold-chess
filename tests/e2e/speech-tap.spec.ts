import { test, expect } from "@playwright/test";
import { startStandardGame } from "./helpers";

test("iOS tap mode submits the last interim transcript when recognition ends", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    });

    class FakeRecognition {
      static current: FakeRecognition | null = null;
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      lang = "en-US";
      onresult: ((event: { results: unknown }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      private ended = false;

      start() {
        FakeRecognition.current = this;
      }

      stop() {
        this.end();
      }

      abort() {
        this.end();
      }

      emitInterim(transcript: string) {
        const alternative = { transcript, confidence: 1 };
        const result = Object.assign([alternative], { isFinal: false });
        const results = Object.assign([result], { length: 1 });
        this.onresult?.({ results });
      }

      end() {
        if (this.ended) return;
        this.ended = true;
        queueMicrotask(() => this.onend?.());
      }
    }

    // Chromium may already expose its own SpeechRecognition constructor. The
    // app prefers that unprefixed constructor, so replace both names to ensure
    // the test and the app are using the same fake recognition session.
    for (const property of ["SpeechRecognition", "webkitSpeechRecognition"] as const) {
      Object.defineProperty(window, property, {
        configurable: true,
        writable: true,
        value: FakeRecognition,
      });
    }
    (window as unknown as { finishSpeechTest: (transcript: string) => void }).finishSpeechTest = (transcript) => {
      const recognition = FakeRecognition.current;
      if (!recognition) throw new Error("No active speech-recognition session");
      recognition.emitInterim(transcript);
      recognition.end();
    };
  });

  await startStandardGame(page);
  await page.getByLabel("Start listening").click();
  await page.evaluate(() => {
    (window as unknown as { finishSpeechTest: (transcript: string) => void }).finishSpeechTest("e four");
  });

  await expect(page.getByText("White: e4")).toBeVisible();
});
