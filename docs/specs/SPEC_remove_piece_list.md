# SPEC_remove_piece_list.md — drop the "White: … / Black: …" piece list on endgame positions

Written 2026-10-22 21:20 PT by Claude (planner). Executor: Claude Code. One phase, one commit.

## What Ashish will SEE change
1. On an Endgame Lab position screen, the two text lines under the board ("White: Kc6, Qa5." / "Black: Kb8, Rb7.") are gone.
2. UNCHANGED: the board, the name and code line, "You play White. N pieces.", the result line, every button, the game log's "White: e4" style messages during play.

## Environment facts checked (source zip 2026-10-22 20:38)
- `src/components/endgames/EndgamesPosition.tsx:96-100`: `<p className="mt-1.5 text-sm leading-relaxed text-text-secondary">White: {pieceList(entry.fen, "w")}<br />Black: {pieceList(entry.fen, "b")}</p>`. `pieceList` imported at line 7.
- `pieceList` (`src/services/endgames/catalog.ts`) has no other caller in `src/`. Unit tests: `src/services/endgames/catalog.test.ts:46-56` (`describe("pieceList")`).
- e2e matches on "White: e4" / "Black: " (`game-flow`, `keypad`, `landscape`, `message-log`, `opponent`) are game-log messages, not this screen. Leave them.
- `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v63'`.

## Implementation (decided)
- Delete that `<p>` and the `pieceList` import.
- Delete `pieceList` from `catalog.ts` and its `describe` block in `catalog.test.ts`, since nothing uses it. Keep the rest of the import line in the test file intact.

## Test (write first, red on old code — checklist rule 5)
`tests/e2e/endgames.spec.ts`: open any position from the lab. Assert no text matching `/^White: K/` and `/^Black: K/` is visible on the position screen. Find the position through the UI, never by a hard-coded code (catalog contents change).

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v64`.
- `tenzing backlog add blindfold-chess "Remove piece list text on endgame positions"` at start, `done` in the commit. If Tenzing fails, note it and continue.

## Tiers
- `endgames.spec.ts` red then green, `catalog.test.ts` once. Full `npm run test:all` once at the end.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start/end SHA, red/green, full-suite counts.

## Pre-answered
- Keep `pieceList` for later? No. Unused code goes.
- A failure this change can't touch? Report it with output. Never call it stale.
