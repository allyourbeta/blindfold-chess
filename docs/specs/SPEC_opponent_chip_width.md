# SPEC_opponent_chip_width.md — "Stockfish" must never split; no word may break inside a button

Written 2026-10-23 17:40 PT by Claude (planner). Executor: Claude Code. One phase, one commit.

## NO QUESTIONS
Never stop to ask. Take the defaults here. Never `git push`, never deploy. If `tenzing` fails, skip it and list the commands.

## What Ashish will SEE change
1. On the menu, the Opponent chip is a little wider than the other three chips. "Stockfish" fits on one line, centered, at every phone width down to 360px. Text size and weight unchanged.
2. No other visible change.

## Cause (verified, source zip 2026-10-23 17:20, HEAD 1957c0f)
`src/components/screens/MenuScreen.tsx`: chips grid `grid grid-cols-4 gap-2`; each chip `raised min-h-16 rounded-xl px-1 py-2 text-center`; value span `mt-0.5 block break-words text-base font-bold`. At 375px wide each chip is ~76px, so "Stockfish" doesn't fit and `break-words` splits it ("Stockfis" / "h"). The last spec allowed "wrapping" as a fix; that was wrong for single words.

## Fix (decided)
1. Chips grid: `grid-cols-4` → `grid-cols-[1fr_1.4fr_1fr_1fr]` (Color, Opponent, Variance/Level, Speech order unchanged).
2. Value span: remove `break-words`; add `whitespace-nowrap`.
3. If "Stockfish" still overflows at 360px, raise the Opponent share in steps of 0.1 (max 1.7). Never shrink the font, never let it wrap.

## Rule becomes a check (audit, blocking)
Extend the audit's button-text check: no word inside a button may be split across lines. Implementation: for each visible button's text nodes, for each word (split on spaces), use a Range over that word and assert `getClientRects().length === 1`. Run at all audit viewports, with Stockfish selected for the menu checkpoint. Also add 360×740 as a viewport for the menu checkpoint only.

## Tests (red first)
- The new word-split check fails on current code at 375px (Stockfish chip), passes after.
- At 360, 375 and 393 px widths: the Opponent chip's value is one line (`getClientRects().length === 1` on its text) and its text box lies inside the chip.
- `audit-walk`, `button-fit`, `raised-controls` stay green.

## Housekeeping
- `public/sw.js` `CACHE_NAME` `blindfold-chess-v71` → `v72`.
- `tenzing backlog add blindfold-chess "Opponent chip width, no split words"` at start, `done` in the commit.

## Done means
- One commit, `git add -A`, no push, clean tree. Revert incidental `qa/*.png` changes.
- Report: start/end SHA, final column ratio, red/green, any other button the word-split check found and how it was fixed (padding or width only), full-suite counts.

## Pre-answered
- Another button has a split word? Fix with width or padding, never font size or wrapping mid-word. List it.
- A failure this change can't touch? Report it with output. Never call it stale.
