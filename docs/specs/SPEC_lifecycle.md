# SPEC — Game lifecycle hardening: stale audio, overlapping starts, engine failures, spacebar

Version 1. Written 2026-10-08 13:05 PT.
No target file. The only visible change is two error lines (decision 3). Ends at commit. Do not push.

## Where this came from

A ChatGPT static review of the 2026-10-08 source. Claude checked each claim against the code. Items 1–5 below are confirmed in source. ChatGPT's item 6 (state refactor) is out: nothing is broken there.

## What was checked before writing this

Source: `blindfold-chess_source_2026-10-07_232508.zip` (SHA 4d2c96c).

- Speech reset: `resetSpeechQueue` (`src/hooks/useSpeechOutput.ts:123–126`) empties `queue` and calls `speechSynthesis.cancel()`. It does not stop Web Audio clips. `drainQueue` (`:133–160`) awaits `playClipSequence` and keeps going.
- The reset runs only when `audioEvent` becomes null (`:177–179`), i.e. at a game start. Returning to the menu does not reset.
- Clips: `playClipSequence` (`src/services/audio/clipPlayer.ts:84–160`) awaits `loadClip` for all ids, then schedules one `AudioBufferSourceNode` per clip and resolves on the last `onended` or a watchdog. It has no cancel handle. Clips loading when a reset happens are still scheduled afterwards.
- Game start: `beginGame` (`src/state/gameFlow.ts:182+`) awaits `engineManager.restart()` when `isThinking` (`:188`), with no try/catch and no guard against a second `beginGame` overlapping. Callers: `startNewGame` (`gameStore.ts:109`), `startFromSetup` (`:114`), `startEndgame` (`:128`).
- UI callers await and then navigate with no catch: `MenuScreen.tsx:72–80` (`handleStart`), `EndgamesScreen.tsx:42–45` (`playBlindfold`), plus the setup screen and game-over Try again / Another of this size paths.
- Engine recovery: `handleEngineFailure` (`gameFlow.ts:84–96`) restarts, then requests a move if it is the engine's turn. It does not check the game is the one that failed.
- Engine manager already has a request `generation` counter for stale searches (good; keep).
- Spacebar: `App.tsx:30–40` calls `doPeek` on any screen unless an `<input>` has focus, and always `preventDefault()`s, which stops Space activating a focused button.
- Menu already shows "Engine failed — Retry" when `engineStatus === "failed"` (`MenuScreen.tsx:148`).
- SPEC_CHECKLIST.md rules 1–14 and 2026-10-04 additions: checked. Notes at the end.

## Decisions you will see

1. No visible change in normal use.
2. Leaving a game, or starting a new one, cuts off any move still being spoken.
3. If the engine fails while starting a game, you stay where you are and see one line:
   - On the Endgames position screen, under the buttons: "The engine did not start. Tap Play Blindfold to try again."
   - On the menu: the existing "Engine failed — Retry" state.
   - On the setup screen: the existing setup error line, with the same sentence using "Play Blindfold".
   - From the game-over panel's Try again / Another of this size: the panel stays open and shows the same sentence under its buttons, naming "Try again".
4. On a desktop keyboard, Space only peeks on the play screen, and it no longer blocks Space on buttons elsewhere.

## Decisions made for you

- One `gameSession` number in the game flow, incremented at the very start of every `beginGame`. Every async step after an await checks it is still current before writing state or asking the engine for a move. Engine recovery captures it too.
- `beginGame` returns `Promise<boolean>` (true = game installed). Store `start*` actions pass that through. Callers navigate only on true.
- Speech gets a matching cancel: a module-level playback token. `resetSpeechQueue` bumps it, stops every scheduled source of the current sequence, and any sequence whose token is stale stops before scheduling.

---

## Part 0 — Start (tier: none, ~1 min)

`git status` clean. Branch `main`. `git merge-base --is-ancestor 4d2c96c HEAD`. Record HEAD.

## Part 1 — Stale speech (tier: unit + e2e, ~20 min)

1. `clipPlayer.ts`: `playClipSequence(ctx, ids, gapMs, signal?: AbortSignal)`. If `signal` is aborted after loading, return without scheduling. If aborted while playing, call `stop()` on every source, disconnect, resolve.
2. `useSpeechOutput.ts`: hold one `AbortController` for the current drain. `resetSpeechQueue` aborts it, empties `queue`, cancels `speechSynthesis`. `drainQueue` creates a fresh controller per utterance and stops the loop when aborted.
3. Call `resetSpeechQueue` also when returning to the menu (`returnToMenu` / `handleMenu` path).
4. Unit tests with a fake `AudioContext` (sources record `start`/`stop`): reset mid-sequence stops all sources; reset during loading schedules nothing; next utterance after reset plays normally.
5. Red before green: remove the abort check after loading, show the "reset during loading" test fail, restore.
6. E2E: start a game with speech on, make a move so the engine reply is spoken, leave mid-announcement (Leave), assert the speech store's `speaking` is false within 300 ms.

## Part 2 — One game at a time (tier: unit, ~20 min)

1. `gameFlow.ts`: `let gameSession = 0`. First line of `beginGame`: `const session = ++gameSession`. After every await inside `beginGame`, `if (session !== gameSession) return false`.
2. Wrap the restart in try/catch. On failure: set `engineStatus` to "failed", return false. Do not install a half-started game.
3. `handleEngineFailure`: capture `session` before restarting; after the restart resolves, do nothing unless `session === gameSession` and the position FEN is unchanged.
4. `startNewGame`, `startFromSetup`, `startEndgame` return the boolean.
5. Unit tests with a controllable fake engine manager (restart returns a promise the test resolves):
   - Two `beginGame` calls, first restart resolves after the second: final state is the second game only, and only one engine move request is made.
   - Restart rejects: `beginGame` resolves false, `engineStatus` is "failed", the previous state is not half-overwritten.
   - Engine failure, then a new game before recovery resolves: the recovery makes no move request.
6. Red before green: remove the session check after the restart await, show the first test fail, restore.

## Part 3 — Callers handle failure (tier: unit + e2e, ~10 min)

1. `MenuScreen.handleStart`, `EndgamesScreen.playBlindfold`, the setup screen's start, and the game-over Try again / Another of this size: navigate only on true. On false, show the line from decision 3.
2. E2E: force engine restart failure (use the existing test hook for engine failure if one exists in `tests/e2e/helpers.ts`; otherwise add a `window.__failNextEngineRestart` flag read by the engine manager in test builds only). Start an endgame mid-think → stays on the position screen with the sentence. Retry after clearing the flag → game starts.

## Part 4 — Spacebar (tier: unit, ~5 min)

1. `App.tsx`: only peek when `screen === "play"`, no modal is open, focus is not on a button, input, select or textarea, and `!e.repeat`. Only then `preventDefault()`.
2. Unit or e2e: Space on the menu activates the focused button; Space on the play screen with nothing focused peeks.

## Part 5 — Finish (tier: full suite once, ~5 min)

1. `npm run test:all` once (includes `webkit-iphone`).
2. File nothing new unless found. Close any matching Tenzing items: `tenzing backlog list blindfold-chess`.
3. `git add -A && git commit -m "Lifecycle: cancel stale speech, one game session at a time, handle engine start failures, scope spacebar"`.
4. Do NOT push.

## Report

Starting and ending SHA. PROVEN with each red-before-green. UNVERIFIED: real phone audio cut-off; engine failure on a real device. Never "done".

## Checklist notes

1. No parked questions. The engine-failure test hook is pre-answered.
2. Every claim cites file and line.
3. Race tests drive the real `beginGame` with a fake engine whose timing the test controls; the speech test drives the real queue with a fake audio context.
4. Tiers and times stated.
5. Red before green in Parts 1 and 2.
6. Worth the run: items 1–5; item 6 dropped with reason.
7. Visible decisions at the top.
9. Checked: memory, this conversation, the repo zip, the ChatGPT review (each claim verified).
10. No live data steps.
12. Fixes are done, not investigated.
13. Counterparts: reset ↔ menu return; session ↔ recovery; boolean result ↔ every caller.
14. States: normal start, overlapping start, failed start (each caller), mid-speech leave.
