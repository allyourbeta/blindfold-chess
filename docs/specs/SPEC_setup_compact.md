# SPEC_setup_compact.md — shorter Position Setup screen, rotate button in the header

Written 2026-10-22 by Claude (planner). Executor: Claude Code. One phase.
Visual target: `docs/targets/setup-compact.html` (approved by Ashish). Match it.

## What Ashish will SEE change (nothing else on screen may change)
1. The instruction line under "Position Setup" is gone.
2. The "SIDE TO MOVE" heading is gone. A short "To move" label sits on the same row, left of the White/Black switch.
3. The "Castling rights" box and its label are gone. Four toggle buttons in ONE row replace them: white king + "O-O", white king + "O-O-O", black king + "O-O", black king + "O-O-O". Lit means allowed.
4. The bottom buttons read "Reset", "Clear", "Play Blindfold", on ONE row. Behaviour is unchanged.
5. The "White's view / Black's view" button under the setup board is gone. An icon-only rotate button (two arrows, up and down) sits in the header's right corner. Rotation is still the shared setting, so it still carries over to a peek.
6. UNCHANGED: piece palette, board, FEN row (same placeholder and Load button), title text, back button. Peek and endgame boards keep their existing rotate button.

## Environment facts checked (source zip 2026-10-22 00:38, HEAD after 7893d3d)
- Screen: `src/components/screens/SetupScreen.tsx` (197 lines). Instruction `<p>` in the header; "Side to move" span + `SegmentedControl`; castling box with four checkboxes from `CASTLING_KEYS`/`CASTLING_LABELS`; three buttons "Reset Standard", "Clear Board", "Play Blindfold" in a `flex-wrap` row.
- `src/components/board/SetupBoard.tsx:55` renders `BoardPanel`.
- `src/components/board/BoardPanel.tsx` owns the rotate button (`FlipVertical2`, aria-label "Rotate the board 180 degrees", text "White's view"/"Black's view"). Used by SetupBoard, `PeekPanel.tsx:29`, `EndgamesPosition.tsx:78`.
- Rotation: `settingsStore.toggleBoardFlip(currentDefault)` and `boardFlipOverride` (`src/state/settingsStore.ts:28,78`). SetupScreen's default is `playerColor === "b"`.
- `Button` (`src/components/ui/Button.tsx`) has an `active` variant and sizes all ≥44px. Font size lives in the size variant only (project rule: one font size per element; never add a text-* class next to a Button size).
- `PieceGlyph` renders an `<img>` at 85% of its parent; wrap it in a small fixed box for the castling toggles.
- Tests that use setup text: `tests/e2e/setup-position.spec.ts:48,60` use `/Clear Board/`. "Paste FEN string..." is used in `keypad.spec.ts:17,49,93`, `engine-lifecycle.spec.ts:112`, `setup-position.spec.ts:32`. Keep that placeholder exactly.
- `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v56'`.
- Playwright projects `chromium` and `iphone` (390×844). Port 4190.

## Implementation (decided)
- `BoardPanel`: add `showRotate?: boolean`, default `true`. `SetupBoard` passes `false`. No other caller changes.
- `SetupScreen` header: delete the instruction `<p>`. Add a right-side button with the same classes as the back button, `lucide-react` `ArrowUpDown` icon, aria-label "Rotate the board 180 degrees", onClick `toggleBoardFlip(playerColor === "b")`.
- To-move row: `flex items-center gap-2`, label "To move" (`text-sm text-text-secondary`), `SegmentedControl` in a `flex-1` wrapper. Keep its aria-label "Side to move".
- Castling: `grid grid-cols-4 gap-1.5`. Each a `Button` `variant="secondary"` `size="sm"`, `active={castling[key]}`, `aria-pressed={castling[key]}`, aria-label from `CASTLING_LABELS` (e.g. "White O-O"). Content: king glyph (K or k) in a ~1.25rem box, then "O-O" or "O-O-O". If "O-O-O" doesn't fit at 390px width, use `gap-1` and smaller glyph box. Do not shrink below 44px height.
- Buttons row: `flex gap-2`. "Reset" and "Clear" `secondary` `sm`; "Play Blindfold" `primary` with `className="flex-1"`.
- Screen container `gap-5` → `gap-4`.

## Tests (write first, see red on old code, then fix — checklist rule 5)
Add to `tests/e2e/setup-position.spec.ts`:
1. "castling toggle turns a right off": open setup, tap button "White O-O-O" (aria-pressed true → false), Play Blindfold, read the FEN the same way the existing first test does (More → FEN). Castling field has K, lacks Q. Red on old code: no such button.
2. "compact layout": on `iphone`, Reset, Clear and Play Blindfold tops within 2px of each other; no text "Click a piece"; the rotate button's top is above the board's top.
3. "header rotate flips the board": note `square a1` y, tap the rotate button, a1 is now in the top half of the board.
Update `/Clear Board/` → `getByRole("button", { name: "Clear", exact: true })`.
After the fix, save `test-results/setup-compact.png` (iphone, full page) and compare it to the target by eye. List any difference in the report.

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v57`.
- `tenzing backlog add blindfold-chess "Compact Position Setup screen + header rotate"` at start, `tenzing backlog done <ref>` in the commit. If Tenzing fails, note it and continue.

## Tiers and wall time
- `setup-position.spec.ts` on chromium + iphone: under 1 minute. Red run first, green run after.
- Full `npm run test:all` once at the end: about 3 minutes.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes as last round.
- Report: start SHA, end SHA, red/green per new test, full-suite counts, screenshot differences from the target, and UNVERIFIED items (real phone).

## Pre-answered
- Wrap the castling buttons into two rows if tight? No. One row. Use the shrink steps above.
- Change peek or endgame rotate buttons? No.
- Change "Paste FEN string..." or "Play Blindfold" casing? No.
- A failure this change can't touch? Report it with output. Never call it stale.
