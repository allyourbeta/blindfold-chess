# SPEC: Five release blockers

## Context

An external review of the current tree found five confirmed defects. Four of
them are invisible during ordinary play — playing White, on a phone that has
already cached everything — which is why the suite is green and nobody has
noticed. Two are game-state bugs.

Read this whole spec before starting. Every fix here needs a regression test
that **fails before the fix**, and the report must say so.

## Preconditions (STOP if not met)

- Clean tree on `main`, `npm run test:all` green. If not, STOP and report.
- Branch `release-blockers`. Commit per defect. Do NOT push, do NOT merge.

## Defect 1 — a delayed engine reply can land in a NEW game

`src/state/gameFlow.ts`, `applyEngineMove` / `applyEngineMoveNow`.

Maia answers in ~70ms and the reply is deliberately held back to a randomised
floor (500–900ms) via `setTimeout`. Starting a new game invalidates the
engine request through the manager's generation counter, but **it cannot
cancel or identify that pending timer.**

The guard inside `applyEngineMoveNow` is
`if (s.gameOverFlag || s.chess.turn() === s.playerColor) return;`. That is
correct for a game in progress, but a **new game with the player as Black**
has White to move and the player is Black — so the guard passes, and a reply
computed for the previous position is applied to the new board. If it happens
to be legal there, a move Maia never chose is played and announced. If it
isn't, it surfaces as an engine failure.

Fix by identity, not by heuristic: the delayed application must know which
request it belongs to and drop itself if that request is no longer current.
The manager already has a generation concept — extend it rather than
inventing a parallel mechanism. Cancelling the timer outright on
`beginGame`/`finishGame` is also acceptable; do both if it's cheap.

**Regression test:** start a game as Black, let a reply be in flight, start a
new game, and assert the new game's position is untouched by the old reply.
It must fail against the current guard.

## Defect 2 — takeback strands the game when the player is Black

`src/state/gameStore.ts`, `doTakeback`.

The loop undoes up to two plies and stops when it reaches the player's turn.
Playing Black, after Maia's opening move the history holds one ply: undoing
it empties the history and leaves **White** — the engine — to move. Nothing
requests a new engine move. The keypad is inert because it isn't the
player's turn, and no engine request exists, so the game cannot continue.

Decide and implement one coherent behaviour: either a takeback that lands on
the engine's turn requests the engine's move, or a takeback that would strand
the game is refused with a clear message. State your choice and why.

**Regression test:** as Black, after the engine's first move, take back, and
assert the game is still playable — either the engine moves, or the takeback
was refused and the position is unchanged. Not a dead end either way.

## Defect 3 — the app icons were never committed

`scripts/generate-icons.py` renders `public/icons/*.png` from
`assets/icon-user.png`. The script and the source art are committed; the
generated PNGs are not, and `public/icons/` doesn't exist. So
`/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`
and `/icons/apple-touch-icon.png` are all 404: the menu logo, the browser
tab icon and the installed PWA's icons are broken, and the service worker
fails to cache them.

Run the generator, commit the output, and confirm the files appear in
`dist/` after a build.

**And fix the test that hid this.** `tests/e2e/menu-screen.spec.ts` asserts
the logo image is "visible" — which passes for a broken `<img>`, because it
has fixed width and height classes and therefore a non-empty box. Assert the
image actually loaded (`naturalWidth > 0`). Verify the new assertion fails
while the icons are absent, then generate them.

## Defect 4 — move numbering is wrong for custom starting positions

`src/services/chess/gameSummary.ts`, `formatMovePairs`.

It assumes every game starts at White's move 1. A game set up from a FEN with
Black to move on move 37 renders as though its first move were White's move
1 — wrong in the move ticker and wrong in copied PGN. The FEN's counters are
preserved in the position but discarded when formatting.

Use the starting position's move number and side to move. Note that the app
doesn't currently keep the *starting* FEN anywhere the formatter can reach
(the adapter has the same gap — see `historyReconstruct`); adding that is
part of this fix.

**Regression test:** a game from a Black-to-move, move-37 FEN produces
correctly numbered output starting at `37...`.

## Defect 5 — delete `tests/smoke_test.py`

Python left from the pre-Vite app. It expects `public/index.html`, which this
project doesn't have, so it crashes immediately — and it isn't in `test:all`,
so nothing runs it. A broken test in the tree is worse than none: it implies
coverage that doesn't exist.

Delete it. If anything else in the repo references it, remove that too.

## Not in this round

The reviewer also noted: the offline e2e reloads rather than simulating a
true first visit; the "iphone" Playwright project is Chromium at iPhone
dimensions rather than WebKit; README and manifest still describe Stockfish,
voice input and multiple engine levels; and speech reset may not stop an
already-playing Web Audio source. All fair. None are release blockers, and
bundling them would make this round harder to review. Leave them.

## Finish

- Bump `CACHE_NAME` in `public/sw.js` (Defect 3 changes precached assets).
- `npx tsc -b`, `npx vitest run`, `npm run build`, `npm run test:all` green.
- Grep the e2e suite for any string or button you change.
- Commit per defect on `release-blockers`. Do NOT push.
- Report: for each defect, the regression test you wrote and confirmation
  that you watched it fail before the fix; your choice and reasoning for
  Defect 2; and anything you found along the way that isn't in this spec.
