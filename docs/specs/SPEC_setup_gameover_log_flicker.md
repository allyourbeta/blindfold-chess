# SPEC_setup_gameover_log_flicker.md — Edit position after a set-up game, log anchored at bottom, flicker repro

Written 2026-10-22 13:40 PT by Claude (planner). Executor: Claude Code. One phase, one commit.
Visual target: `docs/targets/log-bottom-edit-position.html` (approved by Ashish). Match it.

## What Ashish will SEE change (nothing else may change)
1. **Game-over panel after a set-up game.** Buttons, top to bottom: "Edit position" (primary), "New Game", "Copy PGN", "Menu". "New Game" drops to secondary. Normal games and endgame practice keep their current panels exactly.
2. **Edit position** returns to the Position Setup screen with the board, side to move and castling exactly as they were when Play Blindfold was tapped.
3. **Message log.** Messages sit at the bottom of the log box, next to the keypad. Empty space is above them. Scrolling and auto-follow behave as today.
4. **Flicker.** If reproduced, it stops. Nothing else visible.

## What happened on Ashish's phone (2026-10-22 ~13:15)
Setup: White K + B vs Black K. Play Blindfold. The app correctly declared "Insufficient material. Draw." He tapped the panel's main button, "New Game", expecting to acknowledge the draw. It started a normal game from the opening position, which he read as "a game already in progress." He repeated the setup; it ended in a fresh opening-position game again. During that, the whole screen flickered very fast. Rotating to landscape and back stopped it. His screenshot afterwards shows a tall, empty log box: that is the log (row 3, `minmax(0,1fr)`), grown after round 85 shortened the keys. Not a layout bug, but it reads as a hole.

## Environment facts checked (source zip 2026-10-22 13:19)
- Screens: `src/App.tsx:16` `useState<Screen>("menu")`; setup at `:112` `<SetupScreen onBack onPlay />`; play at `:113-114` `<PlayScreen onMenu onEndgames />`.
- Setup state is local: `SetupScreen.tsx:34-42` (`board` from `STARTING_FEN`, `turn`, `castling`, `enPassant`, `halfmove`, `fullmove`). `handleLoadFen` (`:90-112`) already parses a FEN into all of these. `handlePlay` (`:114`) calls `startFromSetup(fen)` (`:117`).
- `gameStore.startFromSetup` (`src/state/gameStore.ts:~120`) sets `activeEndgame: null`; `startNewGame` sets `activeEndgame: null`; `startEndgame` sets `activeEndgame: { id }` (`:143`). No field records that a game came from setup.
- `gameFlow.beginGame` detects an already-over position and calls `finishGame` (`src/state/gameFlow.ts`, "A set-up position can already be over").
- `src/components/play/GameOverPanel.tsx`: `entry ? <endgame buttons> : <New Game (primary), Copy PGN, Menu>`. Dismissal resets on `gameOverFlag` change (`useEffect` at `:40`).
- `src/components/play/MessageLog.tsx`: scroll div `data-testid="message-log"`, `className="mb-2 min-h-0 flex-1 overflow-y-auto py-1"`, messages are direct children; `atBottomRef` + `onScroll`.
- Layout: `PlayScreen.tsx` grid `grid-rows-[auto_auto_minmax(0,1fr)_auto_auto]`; `shortscape` = `(orientation: landscape) and (max-height: 560px)` (`src/index.css:23`).
- `tests/e2e/play-layout.spec.ts:16` `PHONE_USABLE = { width: 393, height: 742 }`.
- `webkit-iphone` project `testMatch` (`playwright.config.ts:105`): endgames, endgames-scroll, message-log.
- `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v59'`.
- No `.git` in the zip. Record `git rev-parse HEAD` at start.

## Part A — Edit position
- `gameStore`: new field `setupFen: string | null`. `startFromSetup(fen)` sets it to `fen` (only when the game actually starts). `startNewGame` and `startEndgame` set it to `null`.
- `GameOverPanel`: new prop `onEditPosition(): void`. Branches: `entry` → endgame buttons (unchanged); else `setupFen` → Edit position (primary), New Game (secondary), Copy PGN, Menu; else → today's buttons unchanged.
- `PlayScreen`: new prop `onEditPosition(fen: string)`; the panel's handler calls `leaveCurrentGame()` then `onEditPosition(setupFen)`.
- `App.tsx`: `const [setupStartFen, setSetupStartFen] = useState<string | null>(null)`. Menu → setup passes `null` (standard start, as today). Play → Edit position sets it and goes to setup. `SetupScreen` gets `initialFen?: string | null`; when set, its initial state comes from that FEN through the same parsing `handleLoadFen` uses (extract a shared `applyFen(fen)` helper; no duplicate parser). The FEN text box stays empty.

## Part B — log anchored at bottom
In `MessageLog.tsx`, make the scroll div `flex flex-col` and wrap the messages in one inner `<div className="mt-auto">`. Do NOT use `justify-content: flex-end` on the scroll container (it makes the top unreachable when content overflows). `atBottomRef`, `onScroll` and the scroll effect stay as they are. Landscape unchanged.

## Part C — flicker: reproduce, then fix
1. New `tests/e2e/flicker.spec.ts`, added to `webkit-iphone` `testMatch`, also run on `iphone`. Viewport `PHONE_USABLE` on `iphone`.
2. Steps, exactly as Ashish did them: menu → Set up a position → Clear → place White king e1, White bishop c1, Black king e8 → Play Blindfold → draw panel appears → tap "New Game" (current label; after Part A it's the secondary button) → Back → Leave if asked → Set up a position → same three pieces → Play Blindfold → panel → "New Game" again.
3. After each step settles (500 ms), run a 3-second quiet check: a `MutationObserver` on `document.body` (subtree, attributes, childList, characterData) plus a per-frame sample of `message-log` `clientHeight`/`scrollTop` and `document.body` bounding box. Pass = at most 3 mutations and no sampled value changing. Print counts on failure.
4. Run it on the OLD code first. Record per project: reproduced or not, at which step, and what was mutating (element, attribute).
5. If reproduced: find the cause, fix it at the cause (no debounce or timer masking), and keep the test. If not reproduced in either engine: leave the test in as a guard, and report "not reproduced" plainly with the step-by-step counts. Do not guess at a fix.

## Tests (write first, red on old code where possible — checklist rule 5)
1. `setup-position.spec.ts`: set up K+B vs K, Play → panel shows "Edit position" as the first button. Tap it → setup screen shows white king e1, white bishop c1, black king e8, White to move. Red on old code.
2. Same file: after a normal "New Game" from the menu ends (resign), the panel's first button is "New Game", and there's no "Edit position". After an endgame ends, panel unchanged (existing endgame tests cover it; must stay green).
3. `message-log.spec.ts`: at game start, the first message's bottom is within 16px of the log's bottom. Red on old code. Existing three tests stay green unchanged.
4. Part C `flicker.spec.ts` as above.

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v60`.
- `tenzing backlog add blindfold-chess "Edit position after set-up game, log at bottom, flicker repro"` at start; `done` in the commit. If Tenzing fails, note it and continue.

## Tiers and wall time
- E2E touched specs: setup-position, message-log, flicker, endgames-results. About 3 minutes.
- Full `npm run test:all` once at the end: about 4 minutes.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start/end SHA; red/green per new test; flicker result per project with counts, cause and fix if found; full-suite counts; screenshot of the play screen at `PHONE_USABLE` and of the set-up game-over panel, compared to the target.
- UNVERIFIED: the flicker on Ashish's real iPhone.

## Pre-answered
- Remember the edited position across app restarts? No. In-memory only.
- Fill the FEN text box on Edit position? No.
- Change the endgame or normal-game panels? No.
- Flicker not reproduced: ship Parts A and B anyway, keep the guard test, report it.
- A failure this change can't touch? Report it with output. Never call it stale.
