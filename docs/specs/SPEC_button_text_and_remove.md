# SPEC — Larger button text, and a compact Remove button

Version 1. Written 2026-10-20 10:30 PT.
Ends at commit. Do not push. Do not deploy.

## What was checked before writing this

Source: `blindfold-chess_source_2026-10-19_235804.zip`.

- Button sizes live in `src/components/ui/Button.tsx` (`buttonVariants`). Each size variant owns its font size on purpose; the comment at the top explains the Tailwind ordering trap (a font size in the base string or an appended `text-*` class can silently lose). Change sizes only inside the variants.
- Current label sizes: `default`, `sm`, `icon`, `keypadPiece`, `big` use `text-sm` (14px). `random` uses `text-xs` (12px). `chooser` (text-lg), `keypadKey` (text-2xl) and `keypadRow` (text-base) are already 16px or larger.
- Eleven raw `<button>` elements exist outside `Button.tsx`: `BoardPanel.tsx`, `SetupBoard.tsx`, `EndgameCard.tsx`, `EndgamesHeader.tsx`, `EndgamesHome.tsx` (2), `EndgamesPosition.tsx`, `MenuScreen.tsx` (4), `PlayScreen.tsx`, `SetupScreen.tsx`, `SegmentedControl.tsx`. Some carry their own 14px label.
- Remove: `EndgamesPosition.tsx:116–123` (a `Button` stretched by its flex-column parent) and `GameOverPanel.tsx:91–99` (`className="w-full"`). Both render full width.
- No e2e test uses `toHaveScreenshot`, so no visual baselines need updating.
- `docs/SPEC_CHECKLIST.md`: checked. Notes at the end.

## Decisions you will see

1. Every button label that is 14px becomes 16px. This covers the shared button sizes and any raw button or segmented-control label that is 14px today.
2. The square Random button's label goes from 12px to 13px.
3. Keypad keys, the move chooser and the castle/backspace row are unchanged. They are already 16px or larger.
4. Button heights stay the same (44px minimum). Only the text grows.
5. Remove becomes a normal-width button that fits its label, aligned to the right, on both the position screen and the end-of-game panel. Still red, still asks to confirm.
6. Nothing else changes: no body text, headings, or non-button text.

## Part 0 — Start (~1 min)

Record `git rev-parse HEAD`. Tree must be clean.

## Part 1 — Shared button sizes (tier: unit, ~5 min)

1. In `buttonVariants`, change `text-sm` to `text-base` in `default`, `sm`, `icon`, `keypadPiece`, `big`. Change `random` from `text-xs` to `text-[13px]`. Leave every other variant alone. Keep the `shortscape:` overrides as they are, except where one sets a 14px label: raise that to 16px too.
2. Update any unit test that asserts the old classes.

## Part 2 — Raw buttons (tier: unit, ~10 min)

For each of the eleven raw `<button>` elements: if its label is 14px, make it 16px the same way that file already sets size. If it's an icon-only button or already ≥16px, leave it. List each one in the report with before → after.

## Part 3 — Remove (tier: endgame e2e, ~5 min)

1. `EndgamesPosition.tsx`: wrap Remove so it does not stretch (e.g. `self-end`), size `sm`.
2. `GameOverPanel.tsx`: drop `w-full`, align right, size `sm`.
3. The existing `tests/e2e/endgames-remove.spec.ts` must still pass. Add one assertion that Remove's width is less than half its container's width on a 390px viewport.

## Part 4 — Nothing overflows at phone width (tier: e2e, ~10 min)

Add `tests/e2e/button-fit.spec.ts`. On a 360×740 viewport, visit Menu, Setup, Play (start a game, open the end-of-game panel), Endgames home, an endgame list, and a position screen (with `#creator` unlocked via the existing test helper or route mock). On each, assert for every visible `button`: `scrollWidth <= clientWidth + 1` (no clipped label), and the page has no horizontal scroll. If a label clips, fix it by letting that button wrap or by tightening its padding, not by shrinking the text below 16px. Report any button you had to adjust.

Save phone-width screenshots of Menu, Play and an endgame position to `qa/button-text-16px-*.png`.

## Part 5 — Finish (tier: full suite once, ~10 min)

1. `npm run test:all`, once.
2. Commit: `Buttons: 16px labels; compact Remove`.

## Report

PROVEN / UNVERIFIED. List: variant changes; each raw button before → after; any button adjusted to fit; screenshot paths.

## Checklist notes

1: no parked questions; sizes, the unchanged variants, and the fix for clipping are decided here. 2: claims cite files and lines. 4: tiers and times per part. 7: decisions at the top. 10: screenshots, because appearance changes. 13: counterparts — shared variants and raw buttons change together, and the new fit test guards the side effect of larger text.
