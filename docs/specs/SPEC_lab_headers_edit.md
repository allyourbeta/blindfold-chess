# SPEC_lab_headers_edit.md — Endgame Lab headers like setup, "Edit position" from a lab position

Written 2026-10-22 21:45 PT by Claude (planner). Executor: Claude Code. One phase, one commit.
Visual target: `docs/targets/endgame-lab-headers.html` (approved by Ashish). Match it.
Runs after SPEC_remove_piece_list.md (round 90). If that isn't committed, stop and say so.

## What Ashish will SEE change (Endgame Lab screens only)
1. **Every lab header** (home, size list, Favorites, position) uses the setup header's look: chevron pill on the left, bold (extrabold, text-xl) centered accent title, the existing right control (dice or star) on the right.
2. **Pill text:** "Menu" on the lab home (it goes to the menu); "Back" on every inner lab screen (it goes back within the lab).
3. **Lab home title** reads "Endgame Lab" (was "Endgames"). Its subtitle "Pick a size, or search." is removed.
4. **Inner screens keep their subtitles**, small and centered under the title: size list "N positions", Favorites "N positions"/"None yet", position screen the matchup (e.g. "Queen vs rook").
5. **Position screen buttons:** "Play Blindfold" becomes full width on its own row. Below it, one row of two: "Another of this size" (unchanged) and new "Edit position". Note: the approved mockup left out "Another of this size"; it stays.
6. **Edit position** opens Position Setup with that position loaded (pieces, side to move, castling as in its FEN). Nothing is saved to the lab. From setup, Play Blindfold plays it; the setup back pill goes to the menu, as today.
7. UNCHANGED: search box, Favorites row, size rows, cards, Remove, result line, setup screen, play screen.

## Environment facts checked (source zip 2026-10-22 20:38; round 90 only removes the piece-list `<p>`)
- `src/components/endgames/EndgamesHeader.tsx`: `flex items-center gap-3 border-b pb-4 pt-2`; back button aria-label "Back", `ArrowLeft`; `<h1 className="text-lg font-semibold text-text-accent">`; required `subtitle` `<p className="text-sm text-text-secondary">`; optional `right`.
- Callers: `EndgamesHome.tsx:41-45` (title "Endgames", subtitle "Pick a size, or search.", right `RandomButton`), `EndgamesSize.tsx:24-28` (bucket label, `${total} positions`, dice), `EndgamesFavorites.tsx:23-27` (Favorites, count, dice), `EndgamesPosition.tsx` (bucket label, family label, star).
- Setup header pattern to copy: `src/components/screens/SetupScreen.tsx` header (grid, `ChevronLeft` pill `h-9` inside `h-11` button, extrabold xl title, invisible spacer).
- Position buttons: `EndgamesPosition.tsx` `grid grid-cols-2 gap-3` with Play Blindfold (`primary`, `size="big"`, `disabled={!canStart}`) and Another of this size (`secondary`, `big`).
- Edit-a-FEN-in-setup path exists: `App.tsx:23` `setupStartFen` state; `SetupScreen` `initialFen` prop (`App.tsx:123`); used today by play screen's Edit position (`App.tsx:128-133`).
- `EndgamesScreen` props: `initialBucket`, `onMenu`, `onPlay` (`src/components/screens/EndgamesScreen.tsx:20-34`); rendered at `App.tsx:137-140`.
- Tests rely on `getByLabel("Back")` for every lab back step, including home → menu (`endgames.spec.ts:199-206`, `endgames-scroll`, `endgames-tap-targets`, `endgames-favorites`). Keep aria-label "Back" on all lab pills, including the home's "Menu" pill.
- `PHONE_USABLE` in `tests/e2e/helpers.ts`. `public/sw.js:3` `CACHE_NAME` after round 90: `v64`.

## Implementation (decided)
- `EndgamesHeader`: props `title`, optional `subtitle`, `backLabel: "Menu" | "Back"`, `onBack`, optional `right`. Layout `grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border-default pb-1.5`. Left cell: pill button (aria-label "Back"), `justify-self-start`. Middle: title `text-center text-xl font-extrabold text-text-accent whitespace-nowrap`, optional subtitle `text-center text-sm text-text-secondary truncate max-w-[60vw]`. Right cell `justify-self-end` holds `right` or nothing. Equal side columns keep the title centered.
- Home: title "Endgame Lab", no subtitle, `backLabel="Menu"`. Size, Favorites, Position: `backLabel="Back"`, subtitles as today.
- Position buttons: Play Blindfold full width (`size="big"`), then `grid grid-cols-2 gap-3` with Another of this size and Edit position (`secondary`, `big`). Edit position enabled whenever the screen is (no engine needed).
- Wiring: `EndgamesPosition` gets `onEditPosition()`; `EndgamesScreen` gets `onEditPosition(fen: string)` and passes `entry.fen`; `App.tsx` sets `setupStartFen(fen)` and `setScreen("setup")`, same as the play screen path. Do not start or record a game.

## Tests (write first, red on old code — checklist rule 5)
At `PHONE_USABLE` and 360×740, chromium + iphone. Reach every screen through the UI; never hard-code a catalog code.
1. Lab home: heading "Endgame Lab"; no text "Pick a size, or search."; title centered (|title center − header center| < 4px); title one line; pill shows "Menu".
2. Size list, Favorites, position: pill shows "Back"; title centered and one line; subtitle present.
3. Position: Play Blindfold spans the full content width (±2px); Another of this size and Edit position share a row (tops within 2px).
4. Edit position: open the first position of the first size row; note its pieces from the board's square labels; tap Edit position; Position Setup shows the same pieces on the same squares and the same side to move. Then Play Blindfold starts a game (status line visible).
5. Hit boxes: every lab pill ≥ 44×44.
Existing lab tests stay green.

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v65`.
- `tenzing backlog add blindfold-chess "Lab headers like setup, Edit position from lab"` at start, `done` in the commit. If Tenzing fails, note it and continue.

## Tiers
- New tests red then green; then `endgames`, `endgames-scroll`, `endgames-tap-targets`, `endgames-favorites`, `endgames-results`, `button-fit` once: about 4 minutes.
- Full `npm run test:all` once at the end.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start/end SHA, red/green per test, full-suite counts, screenshots of lab home and a position at `PHONE_USABLE` compared to the target.

## Pre-answered
- Long subtitle or title at 360px? Subtitle truncates with an ellipsis. Title drops to `text-lg`, never wraps, never shortened.
- Change the setup screen's back destination after Edit position? No, menu as today.
- Save edited positions? No.
- A failure this change can't touch? Report it with output. Never call it stale.
