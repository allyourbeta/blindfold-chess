# SPEC_log_clip.md — message log first line cut off (portrait, iPhone)

Written 2026-10-22 by Claude (planner). Executor: Claude Code. One phase.

## What Ashish will SEE change
1. The message log's top line is never cut off under the "Moves hidden" bar.
2. Nothing else on screen changes. The log still jumps to the newest message when it is full.

## Environment facts checked (from the 2026-10-21 23:48 source zip)
- Only `scrollIntoView` in `src/`: `src/components/play/MessageLog.tsx:18`, `bottomRef.current?.scrollIntoView({ block: "end" })`.
- Every ancestor of the log is `overflow-hidden`: wrapper div `PlayScreen.tsx:85`, grid `PlayScreen.tsx:77`, root `PlayScreen.tsx:60`, and `[data-testid="app-frame"]` in `App.tsx:89`.
- Same bug class already seen here: `tests/e2e/endgames-scroll.spec.ts` header comment. An `overflow-hidden` box is still programmatically scrollable, and nothing lets the player scroll it back.
- Playwright: baseURL `http://localhost:4190`; projects `chromium`, `iphone` (Chromium 390×844), `webkit-iphone` (real WebKit, port 4191, `testMatch` limited to two endgames specs). `WORKERS = 4`. `playwright.config.ts`.
- Helpers in `tests/e2e/helpers.ts`: `startStandardGame`, `submitMove`, `waitForEngineReady`.
- Service worker: `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v55'`.
- No `.git` in the zip, so no starting SHA here. Record `git rev-parse HEAD` before you start.

## Symptom (Ashish's phone screenshot, portrait, game just started)
"Game started. You play White. Opponent:" is clipped at its top edge, right under the ticker. "Maia 1900 · Human" below it is fine. Plenty of empty space sits below the log.

## Decision (made, do it — not an investigation)
Replace `scrollIntoView` with scrolling the log's OWN element: a ref on the log's scroll div, then `el.scrollTop = el.scrollHeight` in the same effect. Remove `bottomRef`. This can never move an ancestor. Do not change any classes or layout.

## Test (new file `tests/e2e/message-log.spec.ts`)
Runs in `chromium`, `iphone`, and `webkit-iphone`. Add the file to `webkit-iphone`'s `testMatch`. Give the log scroll div `data-testid="message-log"`.

Test A, "log is never clipped and no ancestor is scrolled":
- `startStandardGame`, then check. Play `e4` with `submitMove`, wait for the engine reply to appear in the log, then check again.
- The check: walk from `message-log` up to `document.body`. Every element's `scrollTop` must be 0. Then, if the log's `scrollHeight <= clientHeight`, its `scrollTop` must be 0 and the first message's top must be >= the log's top. On failure, print each ancestor's tag, testid and scrollTop.

Test B, counterpart, "auto-scroll still reaches the newest message":
- Play moves until the log's `scrollHeight > clientHeight` (use `iphone`; cap at 12 moves, fail if never full). Assert the last message's bottom is within the log's visible band.

## Red before green (checklist rule 5)
1. Write the tests first, run them on the OLD MessageLog. Record red or green per project.
2. If the old code is green everywhere, prove the assertion can fail: temporarily add `page.evaluate` setting the log wrapper's `scrollTop = 20`, confirm red, remove it. Report the repro as UNVERIFIED in the report. Ashish's phone is then the final proof.
3. Apply the fix. Run the new spec once. Green.

## Housekeeping
- Bump `CACHE_NAME` to `blindfold-chess-v56`.
- `tenzing backlog add blindfold-chess "Message log first line clipped in portrait"` at start. `tenzing backlog done <ref>` in the fix commit. If Tenzing fails, note it and continue.

## Tiers and wall time
- New spec, three projects: about 1 minute.
- Full `npm run test:all` once at the end: about 2–3 minutes.
- No live-model-only tests added.

## Done means
- Fix and test committed in ONE commit with `git add -A`. Do not push. Ashish pushes.
- Report: starting SHA, end SHA, red/green per project from step 1, full-suite counts, and what is UNVERIFIED (real iPhone Safari).

## Pre-answered
- Thinking message or strip flicker? Out of scope. Do not touch.
- Other `scrollIntoView` calls? There are none in `src/`.
- A test fails that this change can't touch? Report it with its output. Do not call it stale.
