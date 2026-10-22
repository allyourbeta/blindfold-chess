# SPEC_log_opponent_style.md — taller log, Stockfish opponent, setup order, label style, haptics out

Written 2026-10-22 12:25 PT by Claude (planner). Executor: Claude Code. One phase, one commit.
Visual target: `docs/targets/round-log-opponent-style.html` (approved by Ashish). Match it.

## What Ashish will SEE change (nothing else may change)
1. **Play screen.** The message log is at least three lines tall on his iPhone. Piece keys drop from 80px to 56px. File/rank keys drop from 80px to 64px. Nothing is hidden, no font shrinks.
2. **Setup screen order.** Board, To move, then Reset / Clear / Play Blindfold, then castling, then the FEN row last.
3. **Menu chips.** Four chips: Color, Opponent, a third chip, Speech. The third reads "Variance" with Maia and "Level" with Stockfish.
4. **Game settings.** New "Opponent" choice: Maia 1900 or Stockfish. With Stockfish, a "Level" choice appears (Easy, Club, Strong, Max) and Variance is hidden. With Maia, Variance shows as today. Both choices are remembered.
5. **Status line and log name the opponent.** With Stockfish: "Stockfish · Strong" and "Stockfish thinking...". With Maia: unchanged.
6. **Menu loading text** names the chosen opponent ("Loading Stockfish...").
7. **Labels on every button** are semi-bold, and sit vertically centered (CSS `text-box` trim). This applies app-wide.
8. **Haptics removed.** Nothing to feel or see. Apple disabled the web trick in iOS 26.5.

## Why the log kept getting cut off (the systemic cause)
It was never a scroll bug after round 82. On Ashish's iPhone the log box is about 36px tall, under 1.5 lines. Every other row has a fixed height, and the log only gets the leftover. Measured from his 2026-10-22 11:44 screenshot (scale 1.94 px/css px): log box ≈ 209–245 css px; keypad keys 80px each.
Our tests never saw it. The `iphone` project is 390×844 with no safe-area insets. His installed app loses about 93px to the status bar and home indicator. So tests had about 90px more room than his phone.

## Environment facts checked (source zip 2026-10-22 12:07)
- Keys: `src/components/ui/Button.tsx` sizes `keypadPiece: "h-20 … shortscape:h-16"`, `keypadKey: "h-20 … shortscape:h-16"`, `keypadRow: "h-9 …"`. Base string has `font-medium`.
- Play layout: `src/components/screens/PlayScreen.tsx` grid `grid-rows-[auto_auto_minmax(0,1fr)_auto_auto]`; log in row 3; keypad wrapper `pt-1`. Entry strip `h-12` in `MoveKeypad.tsx`.
- Log: `src/components/play/MessageLog.tsx`, `data-testid="message-log"`.
- Existing log tests: `tests/e2e/message-log.spec.ts` (3 tests). They check scrolling, not height. That is why they passed.
- Playwright projects: `chromium`, `iphone` (390×844), `webkit-iphone` (iPhone 13, port 4191). `playwright.config.ts:83-106`.
- Button fit check: `tests/e2e/button-fit.spec.ts` at 360×740, menu/setup/play/endgames. It checks clipping and horizontal scroll.
- Engine wiring: `src/engine/createEngineManager.ts` builds `new EngineManager(new MaiaAdapter(), callbacks)`. `StockfishAdapter` (`src/engine/stockfishAdapter.ts`) exists, works over UCI, reads `level.skill` and `level.depth`, not used today.
- `EngineAdapter` (`src/engine/types.ts`) has `readonly id`, `init`, `isReady`, `setLevel`, `requestMove`, `stop`, `dispose`. `EngineLevel` has optional `depth`, `skill`, `randomness`.
- `beginGame` (`src/state/gameFlow.ts:197`) restarts the engine ONLY when `isThinking`; otherwise `abortSearch()`. So a changed opponent would not load without a change here.
- Opponent name: `OPPONENT_LABEL = "Maia 1900"` (`gameFlow.ts:10`), used for the thinking message (`:70`), `setLevel` (`:73`), and `opponentLabelAtStart` (`:229`).
- Menu: chips grid `grid-cols-3` (`MenuScreen.tsx:159`), chips Color/Variance/Speech; "Loading Maia 1900..." at `:147,150`; settings `Card id="game-settings"` with Play as, Variance (`:271`), Engine speaks, etc.
- Persistence pattern: `getRandomness`/`setRandomness` in `src/api/localStore.ts:159-177`; settings store `src/state/settingsStore.ts`.
- `public/engine/stockfish.js` (1.58 MB) is not precached (`public/sw.js:49`). Non-navigation requests are cache-first and cached as fetched, so it is cached on first use. Leave the precache list alone.
- Haptics: `src/services/haptics.ts`, `src/services/haptics.test.ts`, `src/hooks/useHaptics.ts`, `tests/e2e/haptics.spec.ts`, `MoveKeypad.tsx` (`hapticTap`/`hapticError` import, `tapAnd` wrapper at :87, the illegal-move line in `play()`), `PlayScreen.tsx:14,24`.
- Setup: `src/components/screens/SetupScreen.tsx` renders To move, castling grid, FEN row, buttons row (current order).
- `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v58'`.
- No `.git` in the zip. Record `git rev-parse HEAD` at start.

## Part A — taller log (do this first)
1. **Calibrate.** Write `tests/e2e/play-layout.spec.ts`. Find the viewport height, at width 393, where the CURRENT build's log after `startStandardGame` is 34–40px tall. Expect roughly 393×760. Hard-code it as `PHONE_USABLE` with a comment citing the screenshot measurement. This viewport stands in for his phone.
2. **Test (red first):** at `PHONE_USABLE`, start a game, enter an illegal move in Strict mode (so an error message is present). Assert `message-log` `clientHeight >= 3 × line-height` of a message row. Assert the action bar's bottom ≤ viewport height. Also at 375×647 (small iPhone, usable area): action bar fully visible and no button clipped. Run on `chromium` only (viewport-driven). Must be red on the old code.
3. **Fix**, in this order, stopping when green:
   a. `keypadPiece` `h-20` → `h-14`; `keypadKey` `h-20` → `h-16`. Leave `shortscape:` values.
   b. Entry strip `h-12` → `h-11` (still clears the 44px chooser).
   c. Header `pb-2 mb-2` → `pb-1 mb-1`.
   Never hide an element, shrink a font, or change the landscape layout. If a–c are not enough, stop and report the measured log height. Do not invent another lever.
4. Existing `message-log.spec.ts` stays green unchanged.

## Part B — Stockfish as an opponent
- **Settings.** `localStore`: `blindfoldOpponent` (`"maia" | "stockfish"`, default `"maia"`) and `blindfoldStockfishLevel` (`"easy" | "club" | "strong" | "max"`, default `"club"`), same pattern as randomness. `settingsStore`: `opponent`, `stockfishLevel`, setters that persist.
- **Levels** (new `src/engine/stockfishLevels.ts`): Easy `{ skill: 2, depth: 4 }`, Club `{ skill: 8, depth: 8 }`, Strong `{ skill: 15, depth: 12 }`, Max `{ skill: 20, depth: 14 }`. Labels as named. No Elo claims anywhere.
- **Router adapter.** New `src/engine/opponentAdapter.ts` implementing `EngineAdapter`. Constructor takes `getOpponent: () => "maia" | "stockfish"`. Lazily owns one `MaiaAdapter` and one `StockfishAdapter`. `init()` reads `getOpponent()`, disposes the other adapter, inits the chosen one. `id` is a getter returning the active adapter's id. Every other method delegates to the active adapter. `createEngineManager(callbacks, getOpponent)` builds `new EngineManager(new OpponentAdapter(getOpponent), callbacks)`. `gameStore` passes `() => useSettingsStore.getState().opponent`. The engine layer never imports the settings store itself.
- **EngineManager**: add `activeEngineId(): string` returning `this.adapter.id`. No other change.
- **gameFlow.** Replace the constant with `opponentName()` ("Maia 1900" or "Stockfish") and `levelLabel()` (randomness label for Maia, Stockfish level label for Stockfish). Thinking message `${opponentName()} thinking...`. `setLevel` passes `{ label, randomness }` for Maia and `{ label, skill, depth }` for Stockfish. `opponentLabelAtStart = \`${opponentName()} · ${levelLabel()}\``. In `beginGame`, restart when `isThinking` OR `engineManager.activeEngineId() !== selected opponent`. Keep the reply floor for both engines.
- **Menu.** Chips `grid-cols-4`: Color, Opponent ("Maia 1900"/"Stockfish"), third chip "Variance"/"Level" with the matching value, Speech. Loading text uses `opponentName`. In `game-settings`, after Play as: `Field label="Opponent"` with a `SegmentedControl` (Maia 1900 / Stockfish, aria-label "Opponent"). Then either Variance (Maia, unchanged) or `Field label="Level"` with four buttons styled exactly like the Variance buttons, `grid-cols-4`, `aria-pressed`.

## Part C — setup order
`SetupScreen.tsx`: board, To move row, buttons row (Reset, Clear, Play Blindfold), castling grid, FEN row (+ its error line). No other change. Move the `setupError` line to sit directly under the buttons row.

## Part D — label style
- `Button.tsx` base: `font-medium` → `font-semibold`. `SegmentedControl.tsx`: `font-medium` → `font-semibold`. Setup castling toggles: `font-medium` → `font-semibold`.
- `src/index.css`, in the base layer: `button { text-box: trim-both cap alphabetic; }`. Browsers without support ignore it.
- Rule 11 check: in `button-fit.spec.ts`, add an assertion (chromium) that every visible button's computed `textBoxTrim` is `"trim-both"` on menu, setup and play. If the property is unsupported in the test Chromium, assert it via the stylesheet rule text instead and note it in the report.

## Part E — remove haptics
Delete `src/services/haptics.ts`, `src/services/haptics.test.ts`, `src/hooks/useHaptics.ts`, `tests/e2e/haptics.spec.ts`. In `MoveKeypad.tsx` remove the import, the illegal-move line in `play()` and its comment, and the `tapAnd` wrapper (call handlers directly). In `PlayScreen.tsx` remove the import and the hook call. Afterwards `grep -ri haptic src tests` returns nothing.

## Tests (write first, red on old code, then fix — checklist rule 5)
1. Part A: `play-layout.spec.ts` as above.
2. Part B unit: `opponentAdapter.test.ts` with two fake adapters: init picks the one `getOpponent` names; switching then re-init disposes the old one; `id` follows; calls delegate. `localStore` opponent/level defaults and round-trip.
3. Part B e2e (`tests/e2e/opponent.spec.ts`, chromium): open settings, pick Stockfish, Level Easy. Chips read "Stockfish" and "Level / Easy". Start a game, play e4 via keypad. Status line contains "Stockfish · Easy". An engine reply lands in the log within 20s. Reload: settings persist. Switch back to Maia: Variance field and chip return, next game's status says "Maia 1900".
4. Part C: update `setup-position.spec.ts` order test. Reset/Clear/Play tops above the castling group's top, castling above the FEN input.
5. Part D: the `button-fit` addition. Existing fit tests must stay green with 4 chips at 360px.
6. Part E: haptics tests deleted. No replacement.

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v59`.
- `tenzing backlog add blindfold-chess "Taller log, Stockfish opponent, setup order, label style, haptics out"` at start; `done` in the commit. If Tenzing fails, note it and continue.
- Add one line to `CLAUDE.md` under testing: phone-layout checks use `PHONE_USABLE` from `play-layout.spec.ts`, never the raw 390×844 device size, because real iPhones lose ~93px to safe areas.

## Tiers and wall time
- Unit: new tests only, seconds.
- E2E touched specs: play-layout, opponent, setup-position, button-fit, message-log. About 4 minutes. Stockfish reply at Easy is fast; Max is not exercised in tests.
- Full `npm run test:all` once at the end: about 3–4 minutes.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start/end SHA; calibrated `PHONE_USABLE`; log height before/after at it; which Part A levers were needed; red/green per new test; full-suite counts; a screenshot of play, setup and menu-with-Stockfish at `PHONE_USABLE`, compared to the target, with differences listed.
- UNVERIFIED, name them: log height on the real iPhone; Stockfish Max reply time on the phone; text-box trim on iOS Safari.

## Pre-answered
- Precache stockfish.js? No. Cached on first use.
- Show an Elo for Stockfish levels? No.
- Keep variance setting for Stockfish? No, hidden.
- Change the landscape layout? No.
- Rename "Maia 1900"? No.
- A failure this change can't touch? Report it with output. Never call it stale.
