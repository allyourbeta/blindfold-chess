# SPEC_no_squeezed_buttons.md — Play Blindfold squeezed to a sliver; stop it everywhere

Written 2026-10-22 23:10 PT by Claude (planner). Executor: Claude Code. One phase, one commit.

## What Ashish will SEE change
1. On an Endgame Lab position, "Play Blindfold" is its full 64px height again (as in `docs/targets/endgame-lab-headers.html`). Today on his iPhone it renders about 21px tall.
2. No button on any scrolling screen (menu, setup, lab home, size list, Favorites, position) can be squeezed shorter than designed. Nothing else changes.

## Cause (verified in source zip 2026-10-22 22:50)
- `src/components/endgames/EndgamesPosition.tsx:59-62`: the screen is `flex h-full flex-col gap-4 overflow-y-auto …`. Round 91 made Play Blindfold a direct child of that column (it used to sit inside a grid). Flex children shrink by default (`flex-shrink: 1`). When the content is taller than the screen, the browser squeezes the shrinkable children instead of scrolling. A `<button>`'s minimum is its text height, so Play Blindfold (`size="big"`, `h-16`) collapses to ~21px. The grid row below and the board don't shrink the same way, so only the button shows it.
- Same container pattern, same risk, in `EndgamesHome.tsx:39`, `EndgamesFavorites.tsx:21`, `EndgamesSize.tsx:22`, `SetupScreen.tsx:149`, and `MenuScreen.tsx:92` (`main … flex-col overflow-y-auto`).
- Why tests missed it: `tests/e2e/endgames-tap-targets.spec.ts:72,101` run at 390×844, not `PHONE_USABLE` (393×742, `tests/e2e/helpers.ts:17`). At 844px everything fits, nothing shrinks. CLAUDE.md already says phone-layout checks must use `PHONE_USABLE`. That file predates the rule and was never moved.
- The round-91 exemption (`endgames-tap-targets.spec.ts`, `isListItem` includes direct children of `endgame-scroll`) only relaxed the width/height ratio rule. The 44px minimum-height check still applies; it just never ran at a phone-sized height.

## Fix (decided)
1. Add `[&>*]:shrink-0` to each of the six scroll containers above. Direct children keep their natural height; the container scrolls instead. Change no other class.
2. `endgames-tap-targets.spec.ts`: run the "no thin strip" checks at `PHONE_USABLE` AND at 375×647 (small iPhone). Keep 390×844 only for the screenshot block if it's needed for its existing comparison.
3. `button-fit.spec.ts`: add the same 44px minimum-height assertion for every visible button, at `PHONE_USABLE` and 375×647, on menu, setup, lab home, size list, Favorites, position, and play screen. One shared helper in `helpers.ts`; both specs use it.
4. Keep the round-91 ratio exemption for the full-width Play Blindfold. It's an approved design, and the height check now guards it.

## Tests (red on old code first — checklist rule 5)
- At `PHONE_USABLE`, open a lab position through the UI (first size row, first position; never a hard-coded code). Play Blindfold height ≥ 60px. Red on old code (expect ~21px).
- The 44px sweep from Fix 3. Record which buttons fail on old code; all must pass after.

## Housekeeping
- `public/sw.js:3` `CACHE_NAME` `blindfold-chess-v65` → `v66`.
- `tenzing backlog add blindfold-chess "Squeezed buttons on scrolling screens"` at start, `done` in the commit. If Tenzing fails, note it and continue.

## Tiers
- `endgames-tap-targets`, `button-fit`, the new position test: red then green, about 3 minutes.
- Full `npm run test:all` once at the end. Run `npm run build` before any targeted Playwright run (preview serves `dist/`).

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start/end SHA; Play Blindfold height before/after at `PHONE_USABLE`; every button that failed the sweep on old code; full-suite counts.
- UNVERIFIED: real iPhone.

## Pre-answered
- Restructure the position screen? No. `shrink-0` only.
- Other buttons found squeezed by the sweep? They are fixed by the same container change. If one isn't, fix it in this round and list it.
- A failure this change can't touch? Report it with output. Never call it stale.
