# SPEC — Replace the endgame catalog with Ashish's hand-picked positions

Version 1. Written 2026-10-16 14:20 PT.
Ends at commit. Do not push. Do not deploy.

## What was checked before writing this

Source: `blindfold-chess_source_2026-10-15_001704.zip` plus the two zips applied since
(`rename-blindfold-79`, `blindfold-icon-knight-80`, `blindfold-icon-blur-81`). None of those touched endgame code or data.

- Catalog data: `src/data/endgames.json`, 274 entries, built by `scripts/endgames/build.mjs` from `scripts/endgames/sources.json`.
- Codes: `scripts/endgames/codes.json` is `{"next": 275, "retired": []}`. `build.mjs:69–83` rejects missing, repeated, or retired codes.
- Extract recipes: `scripts/endgames/extract.mjs:61–71` knows `wiki-diagram`, `embedded-fen`, `pgn-ply`. No literal-FEN kind exists.
- Results: `build.mjs:31–47`. 7 pieces or fewer → Lichess tablebase (network). 8+ → game result only for `pgn-ply`, else `null`.
- Quiet rule: `build.mjs` refuses non-quiet entries. I ran `isQuiet` (`scripts/endgames/quiet.mjs`) and chess.js on all 11 FENs below: all legal, all quiet, none already over.
- Size groups: `src/services/endgames/catalog.ts:47–52`, four buckets 3–5 / 6–8 / 9–11 / 12–16.
- Home list renders every bucket: `src/components/endgames/EndgamesHome.tsx:83` and `:117`.
- Search placeholder: `EndgamesHome.tsx:54`, "Search: rook, Lucena, opposite bishops…". Search matches name, themes, material label, family label, bucket label (`catalog.ts:208–224`).
- Source line on the position screen: `src/components/endgames/EndgamesPosition.tsx:94`, `Source: {entry.source.title}.`
- Favorites: `favoriteEntries` silently drops unknown codes (tested in `catalogGroups.test.ts`), so old favorites disappear without error.
- I emptied the catalog in a scratch copy and ran the unit suite: 15 failures in 4 files — `catalogShipped.test.ts` (distribution targets for a 274-entry auto-curated set), `catalogShippedResults.test.ts`, `catalogGroups.test.ts`, `gameStore.test.ts` (these read real entries). Five e2e files read the real catalog: `endgames.spec.ts`, `endgames-results.spec.ts`, `endgames-favorites.spec.ts`, `endgames-scroll.spec.ts`, `endgames-tap-targets.spec.ts`. Several assume bucket labels "6 to 8" / "9 to 11" / "12 to 16" and Black-to-move or game-result entries, none of which exist in the new set.
- `docs/SPEC_CHECKLIST.md` rules 1–14 and the 2026-10-04 additions: checked. Notes at the end.

## Decisions you will see

1. The Endgames catalog becomes exactly the 11 positions below. All 274 old positions are gone.
2. Two size groups only: "3 to 5 pieces" (subtitle unchanged, "Kings and a few more") and "6 or more pieces" (subtitle "A bigger ending").
3. A size group with no positions is hidden. Today both groups have positions.
4. The search box hint becomes "Search: rook, queen, pawn…". Every word in it finds something.
5. These positions have no source, so the position screen shows no "Source:" line for them.
6. Positions show their code (E275 and up) as their label, as unnamed positions do today.
7. Any old favorites disappear quietly.
8. Nothing else changes.

## The 11 positions (White to move in all)

Codes in this order. Ids are the lowercase code (`e275`…). `name: null`, `themes: []`, `flip: false`.

| Code | Image | FEN placement | Pieces |
|---|---|---|---|
| E275 | 1 | `2K1N3/3P1n2/8/4k3/8/8/8/8` | 5 |
| E276 | 2 | `3k4/8/8/8/8/8/8/4KBN1` | 4 |
| E277 | 3 | `4K3/4P2k/8/8/6R1/8/8/3r4` | 5 |
| E278 | 4 | `R7/P7/8/8/6K1/8/6k1/r7` | 5 |
| E279 | 5 | `R7/P2r4/3k4/8/2K5/8/8/8` | 5 |
| E280 | 6 | `R7/P5k1/8/2K5/8/8/8/r7` | 5 |
| E281 | 7 | `3Q4/2K5/8/p7/8/8/p7/1k6` | 5 |
| E282 | 8 | `6k1/6p1/7p/3q4/1P3Q2/7P/6PK/8` | 9 |
| E283 | 9 | `2k5/8/p1P5/P2K4/8/8/8/8` | 5 |
| E284 | 10 | `6k1/8/5P2/8/5PK1/8/8/8` | 4 |
| E285 | 11 | `8/4k3/8/4K3/8/4P3/8/8` | 3 |

## Part 0 — Start (tier: none, ~1 min)

Record `git rev-parse HEAD`. Tree must be clean. Read `src/services/endgames/catalog.ts`, `scripts/endgames/build.mjs`, `extract.mjs`, and the five e2e files above before editing.

## Part 1 — Pipeline accepts a hand-picked position (tier: unit, ~5 min)

1. `extract.mjs`: add `kind: "fen"` with fields `placement` and `sideToMove`. It returns `{ placement, sideToMove, result: undefined }` after validating the FEN with chess.js. Throw on an illegal FEN.
2. Make an entry's `source` optional in the manifest. Built entries carry `source: null` when absent. Update the `EndgamePosition` type in `catalog.ts` to `source: { title: string; url: string } | null`.
3. `EndgamesPosition.tsx:94`: render the Source line only when `entry.source` is not null.
4. Unit test for the `fen` kind: a legal FEN round-trips; an illegal one throws. Show it red first by breaking the validation, then revert (checklist 5).

## Part 2 — Replace the catalog (tier: build script, needs network, ~2 min)

1. `sources.json`: replace the whole array with the 11 entries above, `extract: { kind: "fen", placement, sideToMove: "w" }`, no `source` key.
2. `codes.json`: `next: 286`, `retired`: every code `E001`–`E274`. This makes "never reuse a code" enforceable by `checkCodes`.
3. Run `npm run endgames:build`. It fetches tablebase results for the 10 entries with 7 or fewer pieces. E282 (9 pieces, no game) gets `result: null`. If the tablebase is unreachable, retry once; do not hand-write results.
4. Confirm `src/data/endgames.json` has 11 entries whose FENs match the table exactly.

## Part 3 — Two size groups, empty groups hidden, search hint (tier: unit, ~10 min)

1. `catalog.ts:47–52`: `SIZE_BUCKETS` becomes `{3,5,"3 to 5 pieces","Kings and a few more"}` and `{6,32,"6 or more pieces","A bigger ending"}`.
2. `EndgamesHome.tsx`: in both bucket lists (`:83`, `:117`), skip a bucket whose count is 0.
3. `EndgamesHome.tsx:54`: placeholder becomes `Search: rook, queen, pawn…`.
4. Unit test: with a catalog that has no 6+ entries, the home shows only one group. Show it red first.

## Part 4 — Bring the tests up to date (tier: unit + e2e endgame files only, ~15 min)

The rule: tests change, production behaviour does not. Every code path that the old catalog exercised keeps a test.

1. `catalogShipped.test.ts`: delete the tests that encode the old auto-curated mix — the 260–320 total, per-bucket ranges, Black-to-move 40–60%, flipped share, 5+ source hosts, every family in three of four buckets. Keep every structural invariant (legal FEN, no castling/ep, unique id and code, retired/next, fen vs flipped, material-key cap, unique names, quiet, no near-copies, non-empty). Change the https-url test to "url is https when a source exists".
2. Unit tests that need a game-result, flipped, or Black-to-move entry (`catalogShippedResults.test.ts`, `catalogGroups.test.ts`, `gameStore.test.ts`): use a small fixture of entries taken from the old `src/data/endgames.json` as built by the real pipeline (copy them from git history at the Part 0 SHA). Do not construct fixtures by hand (checklist 3).
3. e2e: update bucket helpers to the two new labels. Tests that need an entry kind the catalog no longer has (Black-to-move, game result, a 12+ bucket) use `test.skip(!entry, "<reason>")` so they switch back on automatically when such a position is added. Everything else must run and pass against the new catalog.
4. Run the five endgame e2e files only.

## Part 5 — Make the next additions need no memory (tier: none, ~2 min)

Add to `CLAUDE.md` under a heading "Adding endgame positions": new positions go in `scripts/endgames/sources.json` with `extract.kind: "fen"`, take the next code from `codes.json` and bump `next`, never reuse a retired code, then run `npm run endgames:build`.

## Part 6 — Finish (tier: full suite once, ~10 min)

1. `npm run test:all`, once.
2. One screenshot of the Endgames home on a phone-sized viewport showing the two groups and the new search hint, saved to `qa/endgames-handpicked.png`. This is the evidence for decisions 2–4 (checklist rule 8 extension).
3. Commit: `Endgames: replace catalog with 11 hand-picked positions; two size groups`.

## Report

PROVEN / UNVERIFIED, per checklist 8. List: final entry count and codes; each entry's result; tests deleted and why; tests skipped and the condition that re-enables them; the screenshot path.

## Checklist notes

1: no parked questions; quiet, legality and the result rule were checked here. 2: claims cite files and lines. 3: fixtures come from the real built catalog. 4: tiers and times per part. 5: Parts 1 and 3 show red first. 7: decisions at the top. 10: one screenshot, because the home screen's appearance changes. 13: counterparts named — the new `fen` kind has its build step and its test; the hidden-bucket rule has its unit test; the new source-less entries have the Source-line change. 14: home states covered — two groups, one group (tested), search results unchanged.
