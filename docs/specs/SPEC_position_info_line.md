# SPEC_position_info_line.md — lab position: one info line, Next/Edit, no flip, local flips everywhere

Written 2026-10-23 01:00 PT by Claude (planner). Executor: Claude Code. One phase, one commit.
Visual target: `docs/targets/position-info-line.html` (approved by Ashish). Match it.

## What Ashish will SEE change
1. **Lab position screen**, between board and buttons, one line: a small dot (white or black) + "White to move" / "Black to move", then a score chip ("1–0", "0–1", "½–½"), then the code (e.g. "E285") small, grey, monospace, pushed right.
2. **Named positions only:** the name sits on its own bold line directly above that info line. Unnamed positions get no name line. (Flagged addition — the approved mockup showed only an unnamed case.)
3. **Removed** from that screen: "You play White. 3 pieces.", "Perfect play:" / "Game result:" label text, the large code heading, and the "White's view" flip button.
4. **Board orientation** on a lab position always follows the side to move (Black to move → Black at the bottom).
5. **Buttons** read "Next" (was "Another of this size") and "Edit" (was "Edit position"). The end-of-endgame panel's "Another of this size" also becomes "Next", so the two match. (Flagged addition.)
6. **Board coordinates** (rank numbers and file letters) are larger on every board: 11px → 14px.
7. **Flips are local.** A flip lasts only for the position or game you're looking at. Opening another lab position, starting a game, or opening Position Setup always starts from the default orientation again. Flipping never changes who moves.
8. UNCHANGED: header, Remove, source line, Position Setup's flip button and its "To move" control, play screen peek flip (still works, just resets per game).

## Environment facts checked (source zip 2026-10-23 00:35)
- `src/components/endgames/EndgamesPosition.tsx`: `side = sideToMove(entry)` (line 38); `result = resultDisplay(entry)` (43); `<BoardPanel board={fenToBoard(entry.fen)} defaultFlipped={side === "b"} />` (83); info `<div>` with `displayNameFor(entry)` heading + code span, "You play … pieces." (91), result label + score chip; buttons Play Blindfold / "Another of this size" / "Edit position".
- `resultDisplay` (`src/services/endgames/catalogGroups.ts:112-117`): `{ label: "Perfect play:" | "Game result:", score }`, maps `"1/2-1/2"` → `"½-½"` (hyphen). Results can be null (no chip then).
- `BoardPanel` renders the rotate button unless `showRotate={false}` (`src/components/board/BoardPanel.tsx`).
- Coordinates: `src/components/board/Square.tsx:54,60` `font-mono text-[11px] font-bold`.
- Flip state: `src/state/settingsStore.ts` `boardFlipOverride: boolean | null` (35, 67); reset only in `setPlayerColor` (80); `toggleBoardFlip(currentDefault)` (98-99). Read by `BoardPanel.tsx:40`. So one flip currently sticks across every board until the color setting changes.
- Tests that reference old text: `endgames.spec.ts:94,114,124` ("You play … pieces."), `:176` (panel "Another of this size"), `endgames-results.spec.ts:48-66` ("Perfect play:"), `endgames-scroll.spec.ts:34-37`, `endgames-lab-headers.spec.ts:101-133`, plus "Edit position" in `setup-position.spec.ts` and `flicker.spec.ts` (those are the PLAY game-over panel's "Edit position" — leave that label and those tests alone).
- `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v67'`. `PHONE_USABLE` in `tests/e2e/helpers.ts`.

## Implementation (decided)
- `resultDisplay` → return `{ score, spoken }`: score uses en dashes ("1–0", "0–1", "½–½"); `spoken` = "White wins with best play" / "Black wins with best play" / "Draw with best play" for `perfect`, "White won the game" / "Black won the game" / "The game was drawn" for `game`. Chip gets `aria-label={spoken}`. Update its unit tests.
- Info line: `flex items-center gap-2.5 min-h-11`. Dot: 14px circle, 1.5px border in text-primary, fill white or text-primary. Text `text-base font-bold`. Chip: existing chip styling, `rounded-full`, `text-base font-extrabold`. Code: `ml-auto font-mono text-xs text-text-muted`.
- Name line (only if `entry.name`): `text-xl font-extrabold`, above the info line.
- `BoardPanel` on this screen: `showRotate={false}`; orientation = side to move.
- Labels: "Next", "Edit" on the position screen; the endgame results panel's "Another of this size" → "Next". The play-screen game-over "Edit position" stays.
- `Square.tsx`: `text-[11px]` → `text-[14px]` (both labels).
- Flip reset: add `resetBoardFlip()` to `settingsStore` (sets `boardFlipOverride: null`). Call it when a lab position mounts or its `entry.code` changes, at the start of `beginGame` (`src/state/gameFlow.ts`), and when `SetupScreen` mounts.

## Tests (write first, red on old code — checklist rule 5)
Reach positions through the UI; never hard-code a catalog code. Use a Black-to-move position by searching the list for one (skip with a clear message if the catalog has none, as existing tests do).
1. Position screen at `PHONE_USABLE`: text "White to move" or "Black to move" visible; a chip matching `/^(1–0|0–1|½–½)$/` (when the entry has a result) with an aria-label containing "best play" or "game"; the code visible; no "You play", no "pieces.", no "Perfect play:", no "White's view"/"Black's view", no "Rotate the board" button.
2. Info line is one row: the to-move text, chip and code tops within 4px.
3. Black to move → board's bottom-left square is h8 (Black's view). White to move → a1.
4. Buttons "Next" and "Edit" exist; "Next" opens a different position of the same size; "Edit" opens setup with the same side to move.
5. Flip is local: on the play screen, start a game as White, open peek, flip, close; start a NEW game as White, open peek: board is White's view. And: open Position Setup, flip, go back, open setup again: default orientation.
6. Coordinates: a rank label's computed font-size is 14px.
7. `raised-controls.spec.ts`, `button-fit`, `endgames-tap-targets` stay green.
Update the obsolete assertions listed in the facts section to the new text.

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v68`.
- `tenzing backlog add blindfold-chess "Lab position info line, Next/Edit, local flips"` at start, `done` in the commit. If Tenzing fails, note it and continue.

## Tiers
- New tests red then green; endgames specs, `setup-position`, `raised-controls` once. `npm run build` before targeted Playwright runs.
- Full `npm run test:all` once at the end.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start/end SHA, red/green per test, full-suite counts, screenshots of a White-to-move and (if available) a Black-to-move lab position at `PHONE_USABLE` vs the target.

## Pre-answered
- Info line too wide at 360px with a long code? Code may truncate; to-move text and chip never wrap.
- No result for an entry? Omit the chip; the rest of the line stays.
- Change the play screen's game-over "Edit position"? No.
- A failure this change can't touch? Report it with output. Never call it stale.
