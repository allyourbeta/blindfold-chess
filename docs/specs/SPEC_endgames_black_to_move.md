# SPEC — Add five Black-to-move endgame positions

Version 1. Written 2026-10-16 15:05 PT.
Ends at commit. Do not push. Do not deploy.

## What was checked before writing this

Source: `blindfold-chess_source_2026-10-16_142137.zip` (HEAD fad06da, hand-picked catalog E275–E285).

- Adding positions follows `CLAUDE.md` "Adding endgame positions": `scripts/endgames/sources.json`, `extract.kind: "fen"`, next code from `scripts/endgames/codes.json` (`next` is 286), then `npm run endgames:build`.
- I ran `isQuiet` (`scripts/endgames/quiet.mjs`) and chess.js on all five FENs with Black to move: legal, quiet, none already over.
- Near-copy rule (`catalogShipped.test.ts:108`, exact/shifted/mirrored only): none of the five matches an existing entry. E290 differs from E280 by the black king's square and the side to move.
- Boards for Black to move already start from Black's side (`EndgameCard.tsx:31`, `EndgamesPosition.tsx:58`, `PeekPanel.tsx:32`). No code change.
- The Black-to-move e2e tests in `endgames.spec.ts` use `test.skip(!entry, …)`. They will switch on with this change and have not run against the hand-picked catalog before.
- `docs/SPEC_CHECKLIST.md`: checked. Notes at the end.

## Decisions you will see

1. Five new positions appear, all Black to move, shown from Black's side.
2. E287 has kings and rooks on their home squares, but castling is not allowed, as with every catalog position.
3. Nothing else changes.

## The five positions (Black to move in all)

Ids are the lowercase code. `name: null`, `themes: []`, no source, `sideToMove: "b"`.

| Code | Image | FEN placement | Pieces |
|---|---|---|---|
| E286 | 2 | `4k3/ppp5/2b5/8/8/1B6/1P6/4K3` | 7 |
| E287 | 3 | `4k2r/ppp4p/8/8/8/8/PPP4P/4K2R` | 12 |
| E288 | 4 | `4k3/ppp5/8/8/8/8/PPP5/4K3` | 8 |
| E289 | 5 | `8/6k1/6p1/8/2p1r3/7R/8/2K5` | 6 |
| E290 | 6 | `R7/P7/5k2/2K5/8/8/8/r7` | 5 |

## Part 1 — Add the data (tier: build script, needs network, ~2 min)

1. Record `git rev-parse HEAD`. Tree must be clean.
2. Append the five entries to `sources.json`. Set `codes.json` `next` to 291.
3. Run `npm run endgames:build`. E286, E289, E290 get tablebase results. E287 and E288 get `result: null`. If the tablebase is unreachable, retry once; never hand-write results.
4. Confirm `src/data/endgames.json` has 16 entries and the five FENs end in ` b - - 0 1`.

## Part 2 — Tests (tier: unit + the five endgame e2e files, ~8 min)

1. Run `npm run test:unit`, then the five `tests/e2e/endgames*.spec.ts` files.
2. The Black-to-move e2e tests now run for the first time against this catalog. If one fails, decide whether the test or the app is wrong. Fix a wrong test. If the app is wrong, fix it and keep a regression test. Do not change production behaviour to satisfy an obsolete test.

## Part 3 — Finish (tier: full suite once, ~10 min)

1. `npm run test:all`, once.
2. Commit: `Endgames: add five Black-to-move positions (E286–E290)`.

## Report

PROVEN / UNVERIFIED. List: the five codes with their results; which skipped tests now run, and whether they pass; any test or app change made in Part 2 and why.

## Checklist notes

1: no parked questions; legality, quietness and near-copies were checked here. 2: claims cite files. 4: tiers and times per part. 7: decisions at the top. 10: no screenshot; nothing on screen changes except new list entries.
