# SPEC — Stuck endgame screen, board labels, board grid, three small bugs

Version 1. Written 2026-10-07 18:20 PT.
Target file: `docs/targets/board-and-list.html` (approved v3). Labels = option B. List = option L3.
Ends at commit. Do not push. Do not deploy.

## What was checked before writing this

Source: `blindfold-chess_source_2026-10-07_115048.zip` (last pushed SHA ad913ab).

- Endgame views use `flex h-full w-full flex-col overflow-y-auto p-6` with no safe-area top padding: `EndgamesPosition.tsx:27`, `EndgamesSize.tsx:20`, `EndgamesHome.tsx:30`. Same on `SetupScreen.tsx:110`.
- Screens that DO pad for the iPhone status bar: `MenuScreen.tsx:105` and `PlayScreen.tsx:39` use `pt-[max(1rem,env(safe-area-inset-top))]`. `index.html:5` sets `viewport-fit=cover`, so content draws under the status bar unless padded.
- App frame: `App.tsx`, `flex h-dvh ... flex-col overflow-hidden`. An `overflow-hidden` box can still be scrolled by the browser (focus, tap into view) and the user cannot scroll it back. Suspected cause of "header cut off and stuck". Not yet reproduced.
- Endgame views switch inside one component (`EndgamesScreen.tsx`), so scroll state can carry between views.
- Board coordinates: `Board.tsx` draws ranks in a `w-6` gutter inside the frame and files in a row below it. Board users: `BoardPanel.tsx` (endgame preview, peek), `PeekPanel.tsx`, `SetupBoard.tsx` (check whether it draws its own labels).
- Size list rows: `EndgamesSize.tsx:34–40`, one `<button>` per entry.
- Resign: `ActionBar.tsx:60` calls `doResign` directly. No confirmation.
- Setup error: set at `gameStore.ts:119`, cleared only at `:116` on a successful start. Editing squares (`SetupScreen.tsx:49 handleSquareClick`), Reset (`:60`), Clear (`:71`) and Load FEN (`:79`) leave a stale error on screen.
- Move chooser: `MoveKeypad.tsx` strip `flex h-12 items-center justify-center overflow-x-auto`. Inner groups use `flex flex-wrap ... justify-center`. Wrapping changes height; centred overflow hides the first buttons off the left edge.
- Modal component: `src/components/ui/Modal.tsx` (`open`, `onClose`, Escape support).
- Playwright projects (`playwright.config.ts:64+`): `chromium` and an iPhone-sized Chromium project. No WebKit project. Real iPhone Safari is WebKit.
- SPEC_CHECKLIST.md rules 1–14 and 2026-10-04 additions: checked. Notes at the end.

## Decisions you will see

1. Every board shows its labels inside, on the edge squares: rank numbers top-left of the left column, file letters bottom-right of the bottom row. Applies to the endgame preview and the peek board. The setup board too, if it shows labels.
2. Endgame size screen: a grid of boards, two per row, drawn from the side to move. Under each: "#N" or the position's name (one line, cut with "…"), the piece count on the right, side to move below.
3. Search results use the same grid.
4. Endgame screens and the setup screen no longer sit under the phone's status bar.
5. Opening a position from a long list starts at the top of the page, and the page scrolls.
6. Resign asks first: "Resign this game?" with Cancel and Resign.
7. A setup error disappears as soon as you change the position.
8. The promotion and move chooser stays one row. If it does not fit, it scrolls sideways, and the first button is always visible.

Nothing else changes on screen.

## Decisions made for you

- Grid boards use a new `MiniBoard` component: same squares and piece set as `Board`, no labels, not interactive. Square by construction.
- The stuck screen is reproduced in real WebKit before it is fixed. A WebKit iPhone project is added for that.
- Peek tap-through (ChatGPT's item) stays as is. It is a deliberate design (`PeekPanel.tsx` comment, lines 14–26).

---

## Part 0 — Start (tier: none, ~1 min)

`git status` clean. Branch `main`. `git merge-base --is-ancestor ad913ab HEAD`. Record HEAD.

## Part 1 — Reproduce and fix the stuck screen (tier: e2e WebKit, ~25 min)

1. `npx playwright install webkit`. Add project `webkit-iphone` using `devices["iPhone 13"]`, with `testMatch` limited to `endgames.spec.ts` and the new test file. Do not run the whole suite on WebKit.
2. New test `tests/e2e/endgames-scroll.spec.ts`:
   - Home → "3 to 5 pieces" → scroll the list to the bottom → tap the last board.
   - Assert: the back button's top is at or below 0 and fully visible. The app frame's `scrollTop` is 0. The position page can scroll down to "Source:" and back up to the header. Back returns to the size screen, and Back again to home. No console errors during the flow.
   - Repeat from the search results.
3. Red before green: run it on WebKit BEFORE any fix. It must fail. Record which assertion failed. If it passes, try the same flow at landscape 844x390 and with the list scrolled halfway. If it still cannot be made to fail, say so plainly and continue with the fixes below anyway.
4. Fixes, all of them:
   - Endgame views and `SetupScreen`: top padding `pt-[max(1.5rem,env(safe-area-inset-top))]`, bottom `pb-[max(2.5rem,env(safe-area-inset-bottom))]`. Same pattern as `MenuScreen.tsx:105`.
   - Each endgame view's scroll container scrolls to top when the view changes (key the scroller by view).
   - App frame: `overflow-clip` instead of `overflow-hidden`, so the browser cannot leave it scrolled.
   - Fix the root cause if the failing assertion points elsewhere.
5. The test passes on WebKit and on the iPhone Chromium project.

Pre-answered: if `playwright install webkit` fails, run the test on the iPhone Chromium project only and list real-Safari behaviour as UNVERIFIED.

## Part 2 — Board labels inside (tier: unit + e2e, ~15 min)

Match target Part 1, option B.
- `Board.tsx`: remove the rank gutter and the file row. Ranks top-left on the left-most column. Files bottom-right on the bottom row. Mono, bold, 11–12px. Colour: the opposite square colour, so it reads on both. Flipped boards label correctly (a Black view shows 1 at the top, h at the left).
- `SetupBoard.tsx`: if it draws labels, same treatment. If not, leave it.
- Update any test that relied on the old gutter.
- UI check (rule 11): an e2e assertion that the board element is square within 1px, at iPhone portrait and landscape, on the endgame preview and the peek board.

## Part 3 — Board grid list (tier: unit + e2e, ~20 min)

Match target Part 2, L3.
- `MiniBoard.tsx`: props `fen`, `flipped`. 8x8 square grid, `aspect-ratio: 1`, `min-width: 0` on cells so squares never stretch.
- `EndgamesSize.tsx`: each family group becomes a 2-column grid of tappable cards. Card: MiniBoard (flipped when Black to move), then label row ("#N" or name, truncated; piece count right), then side to move. Whole card is the tap target. Accessible name: "#N, Black to move, 3 pieces" or the name equivalent.
- Search results in `EndgamesHome.tsx`: same card grid, plus the size label in the side-to-move line ("3 to 5 pieces. Black to move").
- "Position N" stays the name used everywhere else (position screen title, accessible name). Only the card label shortens to "#N".
- UI check (rule 11): every MiniBoard in the first screenful is square within 1px, and all 64 squares in one board share one size within 1px. Overlap scan on the size screen at iPhone portrait and landscape.
- Red before green: remove `min-width: 0` from cells, show the square check fail, restore.

## Part 4 — Three small bugs (tier: unit + e2e, ~15 min)

1. Resign confirm. `ActionBar.tsx`: Resign opens a `Modal` with "Resign this game?", a secondary Cancel and a primary Resign. Only Resign calls `doResign`. Escape and Cancel close it. The More sheet's resign path, if any, uses the same confirm. Update e2e tests that resign (endgames game-over test, normal-game test) to confirm.
2. Setup error. Add `clearSetupError()` to the store. Call it from `handleSquareClick`, `handleReset`, `handleClear`, and `handleLoadFen` before it validates. Unit test: set an error, edit a square, error is null.
3. Chooser. In both chooser groups replace `flex-wrap` with `flex-nowrap`. Make the strip start-aligned when it overflows and centred when it fits (`justify-content: safe center`, or an inner `mx-auto` wrapper). Test: 8-button promotion chooser at 320px width keeps the strip height unchanged, and the first button's left edge is at or right of the strip's left edge.

Red before green for each: show the new test failing on the old code, then passing.

## Part 5 — Screenshots and finish (tier: full suite once, ~5 min)

1. Write to `test-results/`: `endgames-size-grid.png`, `endgames-search-grid.png`, `endgames-position-labels.png`, `endgames-position-black-labels.png`, `peek-labels.png`, `resign-confirm.png`, all at iPhone size, plus `endgames-size-grid-dark.png`. Take the position shots from WebKit if it installed.
2. `npm run test:all` once, then the WebKit project once.
3. `git add -A && git commit -m "Fix stuck endgame screen; labels inside boards; board grid list; resign confirm; setup error; chooser row"`.
4. Do NOT push.

## Report

Starting and ending SHA. For the stuck screen: which assertion failed before the fix, on which engine, and the root cause found. PROVEN with every red-before-green. UNVERIFIED: at least real-phone behaviour and how the screens look to Ashish. Never "done".

## Checklist notes

1. Only stop: dirty tree or wrong base. WebKit failure is pre-answered.
2. Claims cite file and line.
3. The scroll test drives the real app in real WebKit, not a mock.
4. Tiers and times stated.
5. Red before green in Parts 1, 3, 4.
6. All items are worth the run. Ashish raised or approved each one.
7. Visible decisions at the top.
9. Checked: memory, this conversation, the repo zip, ChatGPT's review (each claim checked against source; peek item excluded with reason).
10. No live data steps.
11. Square-board and overlap checks added for the new layouts.
12. Fixes are done, not investigated only. The reproduction step cannot block them.
13. Counterparts: label change covers every Board user; grid covers both size and search lists; resign confirm covers every resign path.
14. States: grid with named and unnamed entries, search grid, no-results unchanged, dark mode screenshot, flipped labels.
