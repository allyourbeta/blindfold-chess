# SPEC_setup_header.md — setup screen: designed header, flip by the board, tighter spacing

Written 2026-10-22 20:40 PT by Claude (planner). Executor: Claude Code. One phase, one commit.
Visual target: `docs/targets/setup-header-redesign.html` (approved by Ashish). Match it.

## What Ashish will SEE change (Position Setup screen only)
1. **Back** is a pill: chevron-left icon + "Menu", bold, surface-alt background, 1px border, fully rounded, 36px tall (tap area still ≥44px).
2. **Title** "Position Setup" is bold (extrabold), larger (text-xl), centered, accent color, always one line.
3. **Flip** leaves the header. It becomes a 44×44 icon button at the right end of the "To move" row, directly under the board. Icon: lucide `ArrowDownUp` (two arrows, one up, one down). Same behaviour as now.
4. **Piece buttons** stretch so each row of six spans the board's width (left and right edges line up with the board). Height stays 44px.
5. **Spacing:** white row to black row 6px; black row to board 8px; header bottom padding 16px → 6px, header top padding 8px → 0; page top padding `max(1.5rem, inset)` → `max(1rem, inset)`.
6. UNCHANGED: the board, castling row, FEN row, buttons row, all behaviour. Play screen and endgame screens untouched.

## Environment facts checked (source zip 2026-10-22 20:07)
- `src/components/screens/SetupScreen.tsx` ~line 149: page `div` `flex h-full w-full flex-col gap-4 overflow-y-auto px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]`; `<header className="flex items-center gap-3 border-b border-border-default pb-4 pt-2">` with back button (aria-label "Back to menu", `ArrowLeft`), `<h1 className="flex-1 text-lg font-semibold text-text-accent">Position Setup</h1>`, rotate button (aria-label "Rotate the board 180 degrees", `ArrowUpDown`, onClick `toggleBoardFlip(playerColor === "b")`).
- "To move" row right after `SetupBoard`: label span + `SegmentedControl` in a `flex-1` div.
- `src/components/board/SetupBoard.tsx`: `PaletteGroup` = `flex gap-1.5` of `h-11 w-11` buttons; `SetupBoard` = `flex w-full flex-col items-center gap-4` > `flex flex-wrap justify-center gap-4` (both groups) + `BoardPanel … showRotate={false}`.
- `BoardPanel` wraps `Board` in `flex w-full flex-col items-center gap-2` (`src/components/board/BoardPanel.tsx:45`).
- Tests using these labels: "Back to menu" in `game-flow`, `endgames-scroll`, `helpers.ts:92`, `flicker`; "Rotate the board 180 degrees" in `setup-position.spec.ts:143,215`; heading "Position Setup" at `setup-position.spec.ts:241`.
- `setup-position.spec.ts:143-147` asserts the rotate button is ABOVE the board. That rule is now obsolete; it becomes "below".
- `PHONE_USABLE` in `tests/e2e/helpers.ts`.
- `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v62'`.

## Implementation (decided)
- Keep aria-labels "Back to menu" and "Rotate the board 180 degrees" exactly, so other tests keep working. The pill's visible text "Menu" is fine alongside the aria-label.
- Header: `grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b pb-1.5`. Right column is an invisible spacer the same width as the pill (`aria-hidden`, `invisible`), so the title is truly centered. Title: `text-center text-xl font-extrabold text-text-accent whitespace-nowrap`.
- Pill: a `button` with `h-11` hit area wrapping a `h-9` visual pill, or `min-h-11` with the visual drawn by an inner span. Your choice, as long as the hit box is ≥44px.
- Palette: `SetupBoard` renders the two groups as `flex flex-col gap-1.5` stacked, each group `flex w-full gap-1.5`, buttons `h-11 flex-1`. Put palette and board in a wrapper whose width equals the board's, so edges align; then `gap-2` between palette and board.
- Flip: new 44×44 `Button variant="secondary"` (or the same classes as the castling toggles) at the end of the To-move row.
- Page top padding `max(1rem, …)`. Do not change the bottom padding or the page `gap-4` between lower rows.

## Tests (write first, red on old code — checklist rule 5)
In `setup-position.spec.ts`, at `PHONE_USABLE` and at 360×740:
1. Title is one line: its height < 1.5 × its computed line-height.
2. Title is centered: |(title center x) − (header center x)| < 4px.
3. Rotate button's top is below the board's bottom, and it shares a row with the White/Black switch (tops within 4px). Replace the obsolete above-the-board assertion at lines 143-147.
4. Palette edges: first white piece's left and last white piece's right are within 2px of the board's left and right. Same for the black row.
5. Board's top is at least 30px higher than on the old code at `PHONE_USABLE` (record the old value in the red run, hard-code old − 30 as the bound with a comment).
6. Back pill and rotate button hit boxes ≥ 44×44.
Existing flip test (line 215) stays green with the button in its new place.

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v63`.
- `tenzing backlog add blindfold-chess "Setup header redesign, flip by board, tighter spacing"` at start, `done` in the commit. If Tenzing fails, note it and continue.

## Tiers
- `setup-position.spec.ts` red then green; then `button-fit`, `game-flow`, `flicker` once: about 3 minutes.
- Full `npm run test:all` once at the end.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start/end SHA, board-top position before/after, red/green, full-suite counts, setup screenshot at `PHONE_USABLE` compared to the target.

## Pre-answered
- Change the play screen or endgame headers to match? No. Setup only.
- Rename aria-labels? No.
- Title too wide at 360px? Drop to `text-lg`, keep extrabold. Do not shorten the text.
- A failure this change can't touch? Report it with output. Never call it stale.
