# SPEC_theme_toggle_tap.md — dark-mode toggle only tappable on its top edge

Written 2026-10-22 14:30 PT by Claude (planner). Executor: Claude Code. One phase, one commit.

## What Ashish will SEE change
1. The moon/sun button at the menu's top right works on the first tap, anywhere on the button. Nothing else changes.

## Cause (verified in source zip 2026-10-22 14:09)
- `src/components/screens/MenuScreen.tsx:81-90`: `<header className="relative shrink-0 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">` holds only the toggle, which is `absolute right-4 top-[max(1rem,env(safe-area-inset-top))] h-11 w-11`. An absolute child adds no height, so the header is just its padding. The 44px button hangs about 36px below the header.
- `MenuScreen.tsx:92`: `<main className="relative flex flex-1 …">` comes next. Both are positioned with no z-index, so `main` paints over the button's lower part and takes those taps. Only the top ~8px reaches the button.

## Fix (decided)
Add `z-10` to the toggle button's className. Nothing else.

## Test (write first, red on old code — checklist rule 5)
`tests/e2e/menu-screen.spec.ts`, new test, `iphone` project and chromium: open the app, take the toggle's bounding box, then `document.elementFromPoint(centerX, centerY)` must be the toggle or inside it. Also check the point 8px above its bottom edge. Then click at the center with `page.mouse.click` and assert `<html>` gains the `dark` class. Click again, it is removed.

## Housekeeping
- `public/sw.js:3` `CACHE_NAME` `blindfold-chess-v60` → `v61`.
- `tenzing backlog add blindfold-chess "Theme toggle only tappable at its top edge"` at start, `done` in the commit. If Tenzing fails, note it and continue.

## Tiers
- `menu-screen.spec.ts` only, red then green: under a minute.
- Full `npm run test:all` once at the end.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start/end SHA, red/green, full-suite counts.

## Pre-answered
- Restructure the header? No. `z-10` only.
- Same issue elsewhere? Report any you notice; do not fix them in this round.
