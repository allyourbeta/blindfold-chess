# SPEC: Engine lifecycle — no more frozen games

## Context

Five bugs share one root: nothing owns the engine's lifecycle across game
boundaries. Four of them end the same way — the app looks frozen, keypad
inert, "Engine thinking…" forever. Fix them before Maia lands, because Maia
replaces the adapter and would inherit every one of these holes.

Read `src/state/gameFlow.ts`, `src/state/gameStore.ts`,
`src/engine/engineManager.ts`, and `src/engine/stockfishAdapter.ts` before
changing anything. The manager already has a `generation` counter for
discarding superseded replies — the fixes below extend that idea rather
than inventing a parallel mechanism.

## Preconditions (STOP if not met)

- Clean tree on `main`. If dirty, STOP and report.
- `npm run test:all` passes before you start. If not, STOP and report.

## Bug 1 (HIGH) — a finished game doesn't stop the search

`doResign()` → `finishGame()` sets `isThinking: false` but never stops the
engine. The search runs on. `beginGame()` only restarts the engine when
`isThinking` is true — which resignation just cleared — so the next game can
inherit the old search and consume its `bestmove` as an answer to the new
position. Symptoms: invalid-engine-move message, stale/wrong reply, an
unexplained engine restart, or an apparent hang.

Fix: ending a game must invalidate the engine generation AND stop the
search, so no in-flight reply can ever be delivered to a later game. Add a
manager method for this (e.g. `abortSearch()`: bump `generation`, call
`adapter.stop()`) and call it from `finishGame()`. Do NOT rely on
`beginGame()`'s `isThinking` check to clean up after a resignation — that
conditional is the bug; make `beginGame()` unconditionally safe instead.

Note the phone cost this also fixes: a search left running after
resignation burns CPU and battery.

## Bug 2 (HIGH) — engine failure hangs the app forever

`EngineManager.requestMove()` swallows every failure:

```ts
try { uci = await this.adapter.requestMove(...) } catch { return; }
```

Nothing clears `isThinking`, removes the thinking message, updates status,
or offers recovery. The keypad is permanently inert.

Fix: distinguish "superseded" (correct to ignore silently) from "failed"
(must surface). Give `requestMove` an error path the caller can act on —
an `onError` callback alongside `onMove`, or a resolved result object; pick
one and apply it consistently. On failure, `gameFlow` must clear
`isThinking`, remove the thinking message, and add a user-visible error
message explaining that the engine failed and what to do.

Recovery must be reachable without losing the game: attempt one automatic
engine restart, and if that fails, leave a clear message. A superseded
generation must still be dropped silently — it is not an error.

## Bug 3 (MED-HIGH) — an already-finished set-up position yields a dead game

`beginGame()` never calls `detectGameOver()` on the starting position. Load
a checkmate or stalemate via Set Up a Position and press Play Blindfold:
if it's the player's turn there are no legal moves, no engine request, and
no game-over panel; if it's the engine's turn Stockfish returns
`bestmove (none)`, which the manager drops, leaving "thinking" forever.

Fix: `beginGame()` runs `detectGameOver()` on the initial position and, if
the game is already over, goes straight to the finished state (panel,
message, spoken outcome) and requests nothing.

Secondary: `(none)` from the engine in a position that is NOT over is a
genuine engine failure — route it through Bug 2's error path rather than
dropping it silently.

## Bug 4 (MED) — engine init can hang

`StockfishAdapter.init()` waits forever for `readyok`. A worker that loads
but never initializes leaves the menu on "Loading Stockfish…" with no
failure state; the retry UI only appears on an explicit worker error.

Fix: add an init timeout (10s is reasonable — justify whatever you pick in
a comment) that rejects, disposes the half-started worker, and lands the
manager in its existing `failed` status so the retry UI appears. Clear the
timer on success and on error so no stray timer fires later.

## Bug 5 (LOW) — a game can be recorded twice

`finishGame()` has no re-entry guard, so a duplicated completion path could
append two history entries.

Fix: `if (get().gameOverFlag) return;` at the top of `finishGame()`.

## Tests (required — these bugs exist because none were covered)

Unit tests around `EngineManager` with a fake adapter:

- A failed `requestMove` invokes the error path exactly once.
- A superseded generation stays silent — no move, no error.
- `abortSearch()` (or your equivalent) means a later-arriving reply never
  reaches `onMove`.
- Init timeout leaves status `failed`.

E2e in `tests/e2e/engine-lifecycle.spec.ts`:

- Resign while thinking → New Game → play a move → that move and a sane
  engine reply appear, with no error message.
- Set up a checkmate position → Play Blindfold → the game-over panel shows
  immediately and the keypad is inert.

Keep the existing engine-lifecycle tests passing. Use the existing helpers
(`openApp`, `submitMove`, `waitForEngineReady`) rather than new page setup.

## Finish

- Bump `CACHE_NAME` in `public/sw.js`.
- `npx tsc -b`, `npx vitest run`, `npm run build`, `npm run test:all` green.
- No file over 300 lines.
- Commit on `main`. Do NOT push — Ashish pushes.
- Report: files changed, test counts before/after, the error-surfacing
  design you chose and why, every judgment call, and anything deferred.
