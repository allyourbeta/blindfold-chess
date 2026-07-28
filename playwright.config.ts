import { defineConfig, devices } from "@playwright/test";

/**
 * Timeouts and concurrency are sized for the ENGINE, not the UI. Every test
 * that starts a game loads a 3.3 MB ONNX model plus the onnxruntime-web
 * WASM runtime, and each worker holds its own browser context with its own
 * copy of both. Running many at once makes them all slow enough to miss the
 * clock — which shows up as unrelated specs timing out in
 * `waitForEngineReady`, or a keypad key still disabled because the engine
 * hasn't answered yet. These are the settings that stop that; they are not
 * masking a bug in the app.
 */
const WORKERS = process.env.CI ? 2 : 3;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: WORKERS,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
  },
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Chromium at iPhone 13 dimensions rather than the WebKit device preset
    // — this is a mobile-viewport layout check, not a Safari-engine check
    // (real iOS behavior, especially speech, needs a physical device — see
    // docs/BACKLOG.md).
    {
      name: "iphone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
