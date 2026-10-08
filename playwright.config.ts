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
// Four, raised from two on 2026-10-07 for this session's M5 MacBook Air —
// the full 108-test suite passed cleanly at four workers in ~1.1 minutes,
// with real margin under every timeout (the slowest engine-lifecycle tests
// finished in single-digit seconds). The two-worker reasoning below is kept
// for context: it was a real constraint on the machine this was tuned for
// before, not a rule to re-apply blindly on different hardware.
//
// At three, on that older machine, the two engine-lifecycle tests that act
// on an in-flight reply took ~52s and hit the 60s ceiling; at one worker the
// same two ran in 9.6s and 6.5s. Nothing was wrong with them — three browser
// contexts each loading the 3.3MB model was simply more than that machine
// had. The round-74 reply delay (1.0-1.8s floor per engine move) spends
// wall-clock rather than CPU, so it does not add contention, but it does
// push every engine-waiting test nearer that ceiling — which is what turned
// a marginal setting into a failing one. Raising the timeout instead would
// have bought headroom without reducing load, and made a genuinely hung
// test take 90s to report.
const WORKERS = 4;

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
    baseURL: "http://localhost:4190",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
  },
  /**
   * PORT 4190, NOT Vite's default 4173, and `--strictPort` in the preview
   * script so it fails loudly instead of drifting to the next free port.
   *
   * `reuseExistingServer` means Playwright skips launching a server when
   * something already answers on this URL. On the shared default port that
   * is a silent-wrong-results trap: run a second Vite project's suite at the
   * same time and it reuses THIS app's server, then reports passes and
   * failures for tests that never loaded their own application. A port
   * nobody else defaults to makes reuse safe — it can only ever pick up our
   * own preview server. Do not "tidy" this back to 4173.
   */
  webServer: [
    {
      command: "npm run preview",
      url: "http://localhost:4190",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    /**
     * A second preview server, on its own port, for `webkit-iphone` alone.
     * WebKit refuses to connect to 4190 outright — every navigation there
     * hangs until the test timeout, logging "Not allowed to use restricted
     * network port 4190" to the page console. 4190 is IANA's ManageSieve
     * port, and it's on WebKit's (not Chromium's) built-in list of ports
     * browsers refuse to connect to, same category as SMTP's 25 or X11's
     * 6000 — nothing to do with this app. Confirmed directly: WebKit
     * connects to 4191 fine and to 4190 never, against the same server.
     */
    {
      command: "npx vite preview --port 4191 --strictPort",
      url: "http://localhost:4191",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
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
    // Real WebKit (Safari's engine), not Chromium at iPhone dimensions --
    // for the stuck-scroll bug, which is a WebKit-specific interaction
    // between focus/tap-into-view and an `overflow-hidden` ancestor. Scoped
    // to the two spec files that exercise it; the rest of the suite stays
    // Chromium-only. Its own baseURL — see the second webServer entry above.
    {
      name: "webkit-iphone",
      testMatch: ["endgames.spec.ts", "endgames-scroll.spec.ts"],
      use: { ...devices["iPhone 13"], baseURL: "http://localhost:4191" },
    },
  ],
});
