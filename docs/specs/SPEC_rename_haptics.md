# SPEC_rename_haptics.md — "Blindfolde", haptics, one-tap replace, log stays put

Written 2026-10-22 10:05 PT by Claude (planner). Executor: Claude Code. One phase, one commit.

## What Ashish will SEE (or feel) change — nothing else may change
1. The app name reads "Blindfolde" on the menu title, the game-screen header ("BLINDFOLDE"), the install prompt text, the browser tab, and the home-screen icon label.
2. UNCHANGED on purpose: the "Play Blindfold" buttons. There "blindfold" is the chess term, not the app name.
3. Setup board: tapping a square places the selected piece, replacing whatever is there. Tapping a square that already holds the selected piece removes it.
4. Setup screen: the castling row moves above the FEN row, as in the approved target `docs/targets/setup-compact.html`. Last round built them in the opposite order.
5. Message log: if you scroll up to reread, new messages no longer yank you down. At the bottom, it still follows new messages.
6. Haptics (felt, not seen):
   - one short tap on every keypad key press;
   - a three-tap buzz when a move is rejected;
   - one tap when the engine plays its move.
   No on/off setting. The phone's own System Haptics switch governs it. Laptops feel nothing.

## Environment facts checked (source zip 2026-10-22 09:41)
- Name strings: `src/components/screens/MenuScreen.tsx:133` (h1 "Blindfold"), `:201` ("Add Blindfold to your home screen"), `:221` ("Blindfold can live on your home screen…"); `src/components/screens/PlayScreen.tsx:65` ("BLINDFOLD"); `index.html:6` `<title>`, `index.html:11` `apple-mobile-web-app-title`; `public/manifest.json:3-4` `name`, `short_name`.
- "Play Blindfold" at `SetupScreen.tsx:208`, `EndgamesPosition.tsx:105`, `EndgamesScreen.tsx:133`, `gameStore.ts:124`. Leave all of these.
- Storage keys `blindfold*` in `src/api/localStore.ts` and `CACHE_NAME` prefix `blindfold-chess-` in `public/sw.js:3`: do NOT rename. Renaming would wipe saved settings and history.
- Test on the name: `tests/e2e/menu-screen.spec.ts:8` heading "Blindfold".
- Setup tap logic: `SetupScreen.tsx` `handleSquareClick`: `next[row][col] = next[row][col] ? null : selectedPiece`.
- Setup order: castling grid currently renders after the FEN row (`SetupScreen.tsx`, FEN `<div className="flex gap-2">` then `grid grid-cols-4`).
- Log: `src/components/play/MessageLog.tsx` effect sets `scrollTop = scrollHeight` on every `messages.length` change. `data-testid="message-log"`.
- Keypad: `src/components/play/MoveKeypad.tsx`. Taps go through `pushTap` (line 81) and `pushPiece`; castle keys at 231/241; backspace via `undoTap` and on-screen key. `play()` calls `submitKeypadMove(san)`.
- Rejections: `GameAudioEvent` `{ kind: "illegal-move" }` in `src/state/gameStore.ts:40`, stored as `audioEvent`. Engine moves: `{ kind: "move", by: "engine" }` set in `src/state/gameFlow.ts:155`. `useSpeechOutput` (`src/hooks/useSpeechOutput.ts:173`) is the existing pattern for reacting to `audioEvent`, mounted in `PlayScreen.tsx:22`.
- iOS has no vibration API. Since Safari 17.4, toggling `<input type="checkbox" switch>` fires a system haptic. Android: `navigator.vibrate`.
- `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v57'`.
- Remove button on endgame position is already `size="sm"` `self-end` (`EndgamesPosition.tsx`). That old item is done. Nothing to do.

## Implementation (decided)
**Rename.** Change exactly the seven strings listed above to "Blindfolde" ("BLINDFOLDE" in the game header). Update `menu-screen.spec.ts:8`.

**One-tap replace.** `next[row][col] = next[row][col] === selectedPiece ? null : selectedPiece`.

**Setup order.** Move the castling grid above the FEN row. No other change.

**Log.** Keep an `atBottomRef` updated in an `onScroll` handler (true when `scrollHeight - scrollTop - clientHeight < 24`). The effect scrolls to bottom only when `atBottomRef.current` is true. Default true. Keep scrolling the log's own element only.

**Haptics.** New `src/services/haptics.ts`, no new dependency:
- `hapticTap()`: if `navigator.vibrate` works, `vibrate(10)`. Otherwise click a hidden `<label>` for a hidden `<input type="checkbox" switch>` created once and appended to `document.body` (`aria-hidden`, off-screen, not focusable).
- `hapticError()`: three `hapticTap()` calls about 80 ms apart. On Android, `vibrate([30, 60, 30, 60, 30])` instead.
- Both are no-ops when `document` is missing (unit tests) and never throw.
- Calls: `hapticTap()` at the top of every on-screen keypad key's click path (pieces, file/rank, castles, backspace, chooser buttons). Not for physical-keyboard input. In `MoveKeypad.play()`, after `submitKeypadMove(san)`, read `useGameStore.getState().audioEvent`. If it is `illegal-move`, call `hapticError()`. This keeps the buzz inside the tap gesture.
- Engine move: new hook `useHaptics()` mounted next to `useSpeechOutput()` in `PlayScreen`. Same last-handled-ref guard. On `{ kind: "move", by: "engine" }`, call `hapticTap()`.

## Known risk (state it in the report, do not try to solve it)
iOS may only fire the switch haptic inside a user tap. The engine-move tap and the 2nd/3rd error taps happen outside the tap. They may not be felt on iPhone. Ashish judges this on his phone. Do not add workarounds.

## Tests (write first, see red on old code, then fix — checklist rule 5)
1. `menu-screen.spec.ts`: heading "Blindfolde". Add: `document.title` is "Blindfolde"; the manifest fetched from `/manifest.json` has `name` and `short_name` "Blindfolde". New `tests/e2e/name.spec.ts` or inline, your choice.
2. Game header: on `iphone`, header text is "BLINDFOLDE" and its right edge is inside the viewport.
3. `setup-position.spec.ts`: select black bishop, tap `square a1` (white rook there). Play, read FEN (More → FEN, as the first test does). a1 holds `b`. Then a second test: select white rook, tap `square a1`. a1 is now empty.
4. `setup-position.spec.ts`: the castling group's top is above the FEN input's top.
5. `message-log.spec.ts`: on `iphone`, play moves until the log overflows (reuse Test B's loop). Scroll the log to top. Play one more move and wait for the engine reply. Log `scrollTop` is still < 24. Existing Test B (follows when at bottom) must stay green.
6. `src/services/haptics.test.ts` (unit, jsdom): with `navigator.vibrate` stubbed, `hapticTap` calls it with 10 and `hapticError` with the pattern. With `vibrate` absent, `hapticTap` clicks the switch label (spy on `click`) and creates the input only once.
7. e2e haptics wiring, chromium: `addInitScript` replaces `navigator.vibrate` with a recorder. Tap a keypad piece key: one call. Enter an illegal move in Strict mode: the error pattern is recorded. After the engine replies: one more call.

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v58`.
- `tenzing backlog add blindfold-chess "Rename to Blindfolde, haptics, one-tap replace, log stays put"` at start; `done` in the commit. If Tenzing fails, note it and continue.

## Tiers and wall time
- Unit: haptics test only, seconds.
- E2E: touched specs only (menu-screen, setup-position, message-log, new haptics/name), about 2 minutes, red run then green run.
- Full `npm run test:all` once at the end: about 3 minutes.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start SHA, end SHA, red/green per new test, full-suite counts, and UNVERIFIED items: real-iPhone haptics (all three kinds) and the home-screen label after reinstall.

## Pre-answered
- Rename "Play Blindfold"? No.
- Rename storage keys, repo, domain, or cache prefix? No.
- Add a haptics setting? No.
- Haptics on desktop keyboard entry? No.
- Use the `web-haptics` npm package instead? No. Own 40-line module.
- A failure this change can't touch? Report it with output. Never call it stale.
