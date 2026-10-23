# SPEC_last_quirks_and_mute.md — mute test browsers, beige page, header gap, no default piece, chip centering, text-overflow check

Written 2026-10-23 16:30 PT by Claude (planner). Executor: Claude Code. One phase, one commit.
REPLACES `SPEC_mute_tests.md` (spec-mute-tests-97). Do not run that one; delete it from `docs/specs/` if present.
Visual target: `docs/targets/beige-page-gap-outline.html` (approved by Ashish). Match it.
Starting state: after final-polish commit `216776a`. If HEAD is older, stop and say so in one line.

## NO QUESTIONS
Never stop to ask. Take the defaults here; otherwise the simplest option that keeps current behaviour, logged in the report. Never `git push`, never deploy. If `tenzing` fails, skip it and list the commands. Denied command → skip that step, log it, continue.

## What Ashish will SEE (or hear) change
1. **Silence:** running tests makes no sound on his Mac.
2. **Beige page:** on phones, every screen's page background is the warm beige (`bg-base`, #ece6dc) that already shows in the bands at top and bottom, instead of near-white. No visible line at the edges. Desktop keeps its framed card look. Dark mode stays dark (its base and surface are already close).
3. **Header gap:** every screen's content starts 12px below the status bar (today it starts exactly at it on iPhone).
4. **Position Setup:** no piece is selected when the screen opens. A selected piece shows a thin dark-amber outline instead of the full amber fill. Tapping a square with no piece selected removes whatever is on it (and does nothing on an empty square).
5. **Menu chips:** "Stockfish" (and every chip value) sits centered inside its chip. Chip side padding 8px → 4px; text size unchanged.
6. **Your own moves in the game log** are a darker green, readable on beige.
7. **Any other text** that becomes hard to read on beige moves one shade darker (forced by the audit). Listed in the report.

## Environment facts checked (source zip 2026-10-23 15:51, HEAD 216776a)
- Frame: `src/App.tsx:94` `… flex-col overflow-clip bg-bg-surface sm:h-full … sm:rounded-3xl … shortscape:… rounded-none …`; outer `src/App.tsx:76` `bg-bg-base`.
- Status bar: `index.html:10` `apple-mobile-web-app-status-bar-style` = `black-translucent`; `theme-color` `#37010b`.
- Top padding rule `pt-[max(…,env(safe-area-inset-top))]` in 7 places: `EndgamesHome.tsx:39`, `EndgamesPosition.tsx:71`, `EndgamesFavorites.tsx:21`, `EndgamesSize.tsx:22` (all `max(1.5rem,…)`), `SetupScreen.tsx:156`, `MenuScreen.tsx:110`, `PlayScreen.tsx:68` (all `max(1rem,…)`).
- Setup selection: `SetupScreen.tsx:65` `useState("P")`; tap logic `:100` `next[row][col] = next[row][col] === selectedPiece ? null : selectedPiece`; `SetupBoard.tsx:12,23` `selectedPiece: string`, `:33-36` `aria-pressed`, `raised-on` when selected.
- Chips: `MenuScreen.tsx:178` `className="raised min-h-16 rounded-xl px-2 py-2 text-center"`; value span `text-base font-bold`.
- Tokens `src/index.css`: light `--color-text-accent: var(--color-amber-700)` (68), `--color-text-muted: var(--color-stone-600)` (67), `--color-text-success: #16a34a` (78); dark `--color-text-success: #4ade80` (139).
- Audit: contrast F is blocking; the green log pair is currently exempted by exact ratio in `tests/e2e/audit-walk.spec.ts` ("Needs Ashish"). Overflow check C only inspects `overflow: hidden` elements (`tests/e2e/auditChecksDom.ts`), which is why "Stockfish" spilling out of a `overflow: visible` button was missed.
- Playwright projects: `chromium`, `iphone` (Desktop Chrome 390×844), `webkit-iphone` (iPhone 13, 4191). `openAppAt` init script in `tests/e2e/helpers.ts:29-35`.

## Part A — mute the test browsers (no app change)
1. `playwright.config.ts`: `chromium` and `iphone` get `launchOptions: { args: ["--mute-audio"] }`.
2. Export `muteAudio(page)` from `helpers.ts`: init script wrapping `HTMLMediaElement.prototype.play` (set `this.muted = true`, then call original) and `speechSynthesis.speak` (set `utterance.volume = 0`, then call original). Call it inside `openAppAt`, and before the first `goto` in any `webkit-iphone` spec that doesn't use `openAppAt`.
3. `tests/e2e/mute.spec.ts` (chromium + webkit-iphone; add to its `testMatch`): after `openApp`, a new `Audio().play()` leaves `muted === true`; a spoken utterance has `volume === 0` at speak time. Red first.

## Part B — beige page + header gap
1. `App.tsx:94`: `bg-bg-surface` → `bg-bg-base sm:bg-bg-surface shortscape:bg-bg-base`.
2. All 7 top-padding classes → `pt-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))]` (the four lab screens keep `1.5rem` as the first argument).
3. Do not change any card, input, or button background: they keep their own surfaces and now read as raised off the beige.
4. Tests (red first): a source-level test asserts all 7 screen containers use `calc(env(safe-area-inset-top)+0.75rem)` (Chromium can't emulate an iPhone inset, so this guards the rule itself); an e2e check at 393px width asserts the frame's computed background equals the `--color-bg-base` value.

## Part C — Position Setup selection
1. `selectedPiece` becomes `string | null`, initial `null`. `SetupBoard` props accept `null`. Tap logic: if `selectedPiece === null`, set square to `null`; else as today.
2. Selected palette button: keep `raised` (not `raised-on`) plus `outline outline-[2.5px] outline-offset-1 outline-text-accent`, `aria-pressed=true`. Unselected unchanged.
3. Tests (red first): on entry, no palette button has `aria-pressed=true`; tapping an occupied square with nothing selected empties it; select a piece → its button has `aria-pressed=true` and a non-`none` outline, and no amber gradient. Update any existing test that relied on the white pawn default (select the piece explicitly).

## Part D — chips + text-overflow check
1. `MenuScreen.tsx:178` `px-2` → `px-1`.
2. New audit check (part of C, blocking): for every visible button and its text-bearing descendants, the text's rendered extent (`Range.getBoundingClientRect` over the element's text) must lie within the button's border box (±1px). Applies regardless of `overflow`. Red first on old code (expect at least the Stockfish chip, with Stockfish selected; the walk already selects Stockfish once — make sure the menu checkpoint runs after that).
3. If the check finds other buttons, fix them by padding or wrapping, never by shrinking font size, and list each.

## Part E — contrast on beige
1. Light `--color-text-success` → green-800 `#166534` (your moves in the log). Remove the exact-ratio exemption for that pair from `audit-walk.spec.ts`.
2. Run the audit. Any F failure caused by the beige page: move that token one step darker within its palette (accent `amber-700 → amber-800 #92400e`, muted `stone-600 → stone-700 #44403c`) and re-run. Never change amber BUTTON tokens or introduce a new hue. List every token moved.

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v71`.
- `CLAUDE.md`: testing — "Test browsers are muted (`--mute-audio`, `muteAudio`). Never remove." Layout — "Top padding is always status bar + 12px: `pt-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))]`."
- `tenzing backlog add blindfold-chess "Mute tests, beige page, header gap, no default piece, chip centering"` at start; `done` in the commit.

## Tiers
- Targeted, `npm run build` first: `mute`, `setup-position`, `audit-walk`, `raised-controls`, `button-fit`, `play-layout`.
- Full `npm run test:all` once at the end.

## Done means
- One commit, `git add -A`, no push, clean tree. Revert incidental `qa/*.png` changes.
- Report: start/end SHA; red/green per new test; every token moved and why; every button fixed by the new overflow check; audit findings (expect zero, no exemptions for contrast except board labels); full-suite counts; setup and menu screenshots at `PHONE_USABLE` vs the target.
- UNVERIFIED: real iPhone; that the tests are silent acoustically.

## Pre-answered
- Beige makes the lab's list cards or the FEN input look odd? Leave them on `bg-surface`; that's intended (they read as cards).
- Something in dark mode changes? It shouldn't; if the frame change affects dark mode, keep dark mode's previous frame colour via the `.dark` token and report it.
- A test asserts audio volume or muted state? Report it with output; don't weaken it.
- A failure this change can't touch? Report it with output. Never call it stale.
