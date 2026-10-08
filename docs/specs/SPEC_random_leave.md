# SPEC — Random button, leave-game confirmation, view toggle height, backlog fix

Version 1. Written 2026-10-08 12:25 PT.
Target file: `docs/targets/random-leave.html` (approved v1). Match it.
Ends at commit. Do not push. Do not deploy.

## What was checked before writing this

Source: `blindfold-chess_source_2026-10-07_212357.zip` (SHA 4fc0bfd), plus the last run's report (SHA d4d7369). The newest code was not uploaded, so items marked (report) come from that report and must be confirmed in Part 0.

- (report) `DiceButton` component, used in the `EndgamesHeader` right slot on home, size and favorites; hidden on favorites when empty. A `dice` size variant exists in `Button`.
- (report) `tests/e2e/endgames-tap-targets.spec.ts` excludes the view toggle by name because it is 38px tall.
- View toggle: `BoardPanel.tsx:52–60`, `className` contains `min-h-9`, label "White's view" / "Black's view", `aria-label="Rotate the board 180 degrees"`. Shared by every board.
- Play screen back arrow: `PlayScreen.tsx:41`, `aria-label="Back to menu"`, calls `handleMenu` (`:23`). The game-over panel's Menu button also calls `handleMenu` (`:75`).
- Game-over state: `gameOverFlag` in `gameStore` (read in `GameOverPanel.tsx:25`).
- Existing confirmation pattern: `ActionBar.tsx:127–137` — `Modal`, centred question, `flex gap-2`, secondary Cancel and primary Resign, both `flex-1`.
- CLAUDE.md line 15 tells you to run `tenzing backlog add bc "<title>"`. Last run that failed with "no project named 'bc'".
- lucide-react provides `Shuffle`.
- SPEC_CHECKLIST.md rules 1–14 and 2026-10-04 additions: checked. Notes at the end.

## Decisions you will see

1. Every dice button becomes a 64x64 square button: lucide `Shuffle` icon on top, the word "Random" underneath. Home, size screens, Favorites. Accessible names unchanged.
2. During a game, the play screen's back arrow opens "Leave this game?" with Stay (secondary) and Leave (primary). Leave does exactly what back does today. Stay closes the dialog.
3. After the game is over, the back arrow leaves instantly, no dialog. The game-over panel's Menu button never asks.
4. The view toggle under every board becomes 44px tall. Nothing else about it changes.
5. Nothing else changes.

## Part 0 — Start (tier: none, ~1 min)

`git status` clean. Branch `main`. `git merge-base --is-ancestor d4d7369 HEAD`. Record HEAD. Confirm the (report) items above exist; if any is missing, say so in the report and implement against what is there.

## Part 1 — Random button (tier: unit + e2e, ~10 min)

1. Replace `DiceButton` with `RandomButton` (rename the file and its uses). 64x64, `rounded-2xl`, secondary style, flex column, `Shuffle` 24px, label "Random" in `text-xs font-bold`. Props unchanged: `aria-label`, `disabled`, `onClick`.
2. One font size per element (project rule in CLAUDE.md / `Button.tsx` comment). If you use the `Button` cva, add a `random` size variant that declares its own text size and drop `dice`; do not add a text class on top of a sized variant.
3. Update e2e that referenced the dice. Screenshots: `endgames-size-random.png`, `endgames-home-random.png`.

## Part 2 — Leave-game confirmation (tier: unit + e2e, ~15 min)

1. `PlayScreen.tsx`: the header back arrow calls a new `handleBack`. If `gameOverFlag` is false, open the confirm `Modal` (copy the `ActionBar` resign pattern exactly: same classes, Stay secondary, Leave primary). If true, call `handleMenu` directly.
2. Leave → `handleMenu`. Stay and Escape → close.
3. The game-over panel keeps calling `handleMenu` directly.
4. E2E: start a game, tap back → dialog shows → Stay → still on the play screen with the keypad visible → back → Leave → menu. Second test: resign, dismiss the panel, tap back → menu with no dialog. Run both in the endgame flow too (start an endgame, tap back → dialog).
5. Red before green: make `handleBack` call `handleMenu` unconditionally, show the first test fail, restore.
6. Update any existing e2e that taps "Back to menu" mid-game to confirm with Leave.
7. Screenshot `play-leave-confirm.png`.

## Part 3 — View toggle height (tier: e2e, ~5 min)

1. `BoardPanel.tsx`: `min-h-9` → `min-h-11`.
2. Remove the name exclusion from `endgames-tap-targets.spec.ts`. The check must pass with the toggle included.
3. Red before green: run the check with the exclusion removed BEFORE the height change; it must fail on the toggle. Then change the height; it passes.
4. Landscape: run `landscape.spec.ts` (overlap/escape scans) since the peek board also carries the toggle.

## Part 4 — Backlog command fix (tier: none, ~5 min)

1. Run `tenzing --help` and the project-listing command it documents. Find the project that is this app (blindfold chess / Mind's Eye).
2. If found, replace `bc` in CLAUDE.md line 15 with its real code, then file the backlog items this round would have filed (none expected beyond closing what is done). If no matching project exists, leave CLAUDE.md unchanged and say so in the report with the listing output. Do not create a Tenzing project.
3. Do not block on any failure here.

## Part 5 — Finish (tier: full suite once, ~5 min)

1. `npm run test:all` once (includes `webkit-iphone`).
2. `git add -A && git commit -m "Random button with label; confirm before leaving a game; taller view toggle; backlog code"`.
3. Do NOT push.

## Report

Starting and ending SHA. What Part 0 found for the (report) items. The Tenzing project code found, or the listing if none. PROVEN with each red-before-green. UNVERIFIED: real phone, and how it looks to Ashish. Never "done".

## Checklist notes

1. Only stop: dirty tree or wrong base. Missing report items and Tenzing failures are pre-answered.
2. Claims cite file and line; unverified ones are marked (report) and checked in Part 0.
3. E2E drives the real play screen.
4. Tiers and times stated.
5. Red before green in Parts 2 and 3.
6. All items worth the run; Ashish raised or approved each.
7. Visible decisions at the top.
9. Checked: memory, this conversation, the repo zip, the last report.
10. No live data steps.
11. The tap-target check loses its exclusion, so the rule now covers the toggle.
12. Done, not measured.
13. Counterparts: back arrow ↔ game-over state; random button rename ↔ tests; toggle height ↔ tap-target check.
14. States: mid-game back, game-over back, endgame back, dark mode via existing tokens.
