# SPEC — Square tap targets, dice buttons, known results

Version 1. Written 2026-10-08 11:10 PT.
Target file: `docs/targets/buttons-results.html` (approved v2). Match it.
Ends at commit. Do not push. Do not deploy.

## What was checked before writing this

Source: `blindfold-chess_source_2026-10-07_212357.zip` (SHA 4fc0bfd).

- Position buttons: `EndgamesPosition.tsx:71` "Play Blindfold" and `:74` "Another of this size", full width, default `Button` height (44px).
- Random buttons, full-width strips: `EndgamesHome.tsx:55–56` "Random endgame", `EndgamesSize.tsx:26–27` "Random, {bucket}", `EndgamesFavorites.tsx:43` "Random favorite". Each is disabled until the engine is ready.
- Header: `EndgamesHeader.tsx` has a `right` slot (added last round for the star).
- Tablebase lookup: `scripts/endgames/liveness.mjs:30` `tablebaseCategory(fen)`, cached through `fetchCache.mjs` under `.cache/`. Category is from the side to move's view.
- Game positions: `extract` kind `pgn-ply` reads cached PGNs (`extract.mjs`). It does not read the `Result` header today.
- Flipped entries: `flipped: true` means colours were swapped from `sourceFen`. A game result taken from the source game must be swapped too.
- lucide-react is in use (`EndgamesHeader.tsx` imports `ArrowLeft`). It provides `Dice5`.
- SPEC_CHECKLIST.md rules 1–14 and 2026-10-04 additions: checked. Notes at the end.

## Decisions you will see

1. Position screen: "Play Blindfold" and "Another of this size" sit side by side, each 64px tall, rounded, label may wrap to two lines.
2. Every random button becomes a square 56px dice button showing five pips, at the right of the header: Endgames home, every size screen, Favorites. The long "Random…" strips are gone. Accessible names stay as before ("Random endgame", "Random, 3 to 5 pieces", "Random favorite").
3. Favorites with none saved: no dice button.
4. Position screen, under "You play…": a result line when one is known.
   - 7 pieces or fewer: "Perfect play:" then the score.
   - From a real game, 8 or more pieces: "Game result:" then the score.
   - Otherwise: no line.
   Score chip shows `1-0`, `½-½` or `0-1`, from White's view.
5. Nothing else changes.

## Decisions made for you

- Results are computed at build time and stored as `result: { kind: "perfect" | "game", score: "1-0" | "1/2-1/2" | "0-1" } | null` on each entry. The app never calls the network.
- Perfect play from the tablebase category of `fen`: `win` → side to move wins; `loss` → side to move loses; `draw`, `cursed-win`, `blessed-loss` → `1/2-1/2` (the 50-move rule decides). `maybe-*`, `unknown`, errors → no result.
- A 7-pieces-or-fewer position gets the perfect-play result even if it came from a game. The certain result wins.
- Game result from the PGN `Result` header. `*` or missing → no result. If `flipped`, swap `1-0` and `0-1`.
- Score displayed with `½`; stored with `1/2` for plain ASCII.

---

## Part 0 — Start (tier: none, ~1 min)

`git status` clean. Branch `main`. `git merge-base --is-ancestor 4fc0bfd HEAD`. Record HEAD.

## Part 1 — Results data (tier: unit + one live data step, ~20 min)

1. Extend the build to compute `result` per the rules above. Tablebase calls go through the existing queue and cache.
2. `extract.mjs`: return the game's `Result` header alongside the FEN for `pgn-ply`.
3. Add `result` to the `EndgamePosition` type.
4. `npm run endgames:build` then `npm run endgames:verify`. Exit 0. Report counts: perfect, game, none.
5. Live step reason (rule 10): this writes data. Tablebase answers may be fetched for positions not yet cached.
6. Tests on the shipped JSON (`catalogShipped.test.ts`):
   - Every entry with 7 pieces or fewer has `kind: "perfect"` or `null`. None has `kind: "game"`.
   - Every `kind: "game"` entry has 8+ pieces and an `extract.kind` of `pgn-ply` in the manifest.
   - For every flipped game entry, the stored score equals the source game's result swapped. Read the source result independently from the cache in the test helper, not from the build output (rule 3).
7. Unit tests for the category → score mapping, both sides to move.
8. Red before green: remove the flip swap, show the flipped-game test fail, restore.

## Part 2 — Position screen (tier: unit + e2e, ~10 min)

1. Buttons in a 2-column grid, `gap-3`, each `h-16 rounded-2xl`, label centred, wraps allowed. Primary and secondary styles unchanged.
2. Result line as target frames 1–2: label in secondary text, score in a small bordered monospace chip. `1/2-1/2` displays as `½-½`.
3. E2E: a 3–5 piece position shows "Perfect play:"; a game position with 8+ pieces shows "Game result:"; a large diagram position shows neither.

## Part 3 — Dice buttons (tier: unit + e2e, ~10 min)

1. `DiceButton` component: 56x56, `rounded-2xl`, secondary style, lucide `Dice5` at 26px, `aria-label` passed in, `disabled` passed in.
2. Pass it into `EndgamesHeader`'s `right` slot on home, size and favorites. Remove the three full-width buttons.
3. Favorites: no dice when empty.
4. Update e2e tests that clicked "Random…" by text; use the accessible names.

## Part 4 — Tap target check (tier: e2e, ~10 min)

Rule 11: the design rule "no thin strips" becomes a check.
- New e2e assertion run on endgames home, size, favorites and position screens at iPhone portrait: every visible button is at least 44px tall, and none is wider than 4x its height unless it is a list row or card (those have `data-testid` `endgame-row` or are inside a `.card` list). Report any other offenders by text.
- Red before green: temporarily restore one full-width random strip, show the check fail, revert.

## Part 5 — Screenshots and finish (tier: full suite once, ~5 min)

1. `test-results/`: `endgames-position-perfect.png`, `endgames-position-game.png`, `endgames-position-none.png`, `endgames-size-dice.png`, `endgames-home-dice.png`, `endgames-favorites-dice.png`, iPhone size, plus `endgames-position-perfect-dark.png`.
2. `npm run test:all` once (includes `webkit-iphone`).
3. `git add -A && git commit -m "Endgames: square buttons, dice random buttons, known results"`.
4. Do NOT push.

## Report

Starting and ending SHA. Result counts by kind. PROVEN with each red-before-green. UNVERIFIED: real phone, and how it looks to Ashish. Never "done".

## Checklist notes

1. No parked questions. Every result edge case is pre-answered.
2. Claims cite file and line.
3. The flip test reads the source result from the cache, not from build output.
4. Tiers and times stated.
5. Red before green in Parts 1 and 4.
6. All items are worth the run; Ashish asked for each.
7. Visible decisions at the top.
9. Checked: memory, this conversation, the repo zip.
10. One live step, reason given.
11. The thin-strip rule becomes an automated check.
13. Counterparts: result data ↔ display; flip ↔ score swap; removed strips ↔ tests updated; dice ↔ disabled-until-engine-ready kept.
14. States: perfect, game, none; favorites empty (no dice); dark mode.
