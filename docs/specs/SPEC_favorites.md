# SPEC — Permanent position IDs, search order, favorites

Version 1. Written 2026-10-08 09:50 PT.
Target file: `docs/targets/favorites.html` (approved v1). Match it.
Ends at commit. Do not push. Do not deploy.

## What was checked before writing this

Source: `blindfold-chess_source_2026-10-07_190513.zip` (SHA 51f6fbe).

- Catalog: `src/data/endgames.json`, 274 entries, each with a unique `id` slug like `12-to-16-pieces-minor-2`. The id is copied from `scripts/endgames/sources.json` by `build.mjs:26`. `curate.mjs:43` invents ids with a counter, so a curate re-run can renumber them.
- Visible names: `displayNameFor` (`catalogGroups.ts:94`) builds "Position N" from list order. `cardLabelFor` (`:109`) turns it into "#N". Both shift when an entry is added or removed.
- Search: `search` in `catalog.ts`, rendered in `EndgamesHome.tsx:21` and `:87–89` as a 2-column `EndgameCard` grid, in file order.
- Card: `EndgameCard.tsx` (36 lines). Header: `EndgamesHeader.tsx` (28 lines), no right-side slot.
- Views: `EndgamesScreen.tsx`, internal views `home | size | position`, each keyed so scroll resets.
- Storage: `src/api/localStore.ts` is the only module allowed to touch localStorage (comment at line 5). Keys follow `blindfold…` naming (`:9–12`). Every access is wrapped in try/catch.
- CLAUDE.md has no endgame catalog instructions yet.
- SPEC_CHECKLIST.md rules 1–14 and 2026-10-04 additions: checked. Notes at the end.

## Decisions you will see

1. Every position has a permanent ID like E147. It never changes. A deleted ID is never reused.
2. Cards show the ID in place of "#3". Named positions show the ID, then the name on the next line.
3. Unnamed positions are titled by their ID ("E102") on the position screen, in place of "Position 3". Named ones keep the name, with the ID in small grey text beside it.
4. Search results are sorted by piece count, smallest first, with a size heading above each group ("3 to 5 pieces"). Within a size: piece count, then ID.
5. Endgames home: a "Favorites" row at the top of the page content, above "BY SIZE", with a filled star and the count.
6. Position screen: a star button at the right of the header. Outline = not a favorite. Filled = favorite. Tap toggles.
7. Favorite cards show a small filled star in the board's top-right corner, in every grid.
8. Favorites screen: "Favorites", "N positions", a "Random favorite" button, then the card grid sorted smallest first, each card showing its size.
9. Favorites empty: subtitle "None yet", and "No favorites yet. Tap the star on a position to add it." No random button.
10. Favorites are saved on this phone. Offline. They survive app updates and catalog edits.

Nothing else changes.

## Decisions made for you

- The permanent ID field is `code` (e.g. `"E147"`). The existing slug `id` stays as the internal key so nothing else breaks.
- Initial codes: sort the current 274 by size bucket, then family order, then current file order. Assign E001 to E274. Zero-padded to 3 digits; E1000 and up are fine later.
- `scripts/endgames/codes.json` holds `{ "next": 275, "retired": [] }`. New positions take `next` and bump it. Deleted positions' codes go into `retired`.
- Favorites are stored by `code` under localStorage key `blindfoldFavorites` (a JSON array). Codes that no longer exist are ignored and not counted, and are left in storage untouched (harmless; if a position comes back under a new code it is a new position).

---

## Part 0 — Start (tier: none, ~1 min)

`git status` clean. Branch `main`. `git merge-base --is-ancestor 51f6fbe HEAD`. Record HEAD.

## Part 1 — Permanent codes (tier: unit, ~15 min)

1. Add `code` to every record in `scripts/endgames/sources.json` per the rule above. One-off script, then delete the script.
2. Create `scripts/endgames/codes.json`.
3. `build.mjs` copies `code` into each built entry. It exits 1 if any record lacks a code, a code repeats, or a code is in `retired`.
4. `curate.mjs` / `selectCatalog.mjs`: must preserve existing `code` values and assign new ones from `next`. Never renumber.
5. Add `code: string` to the `EndgamePosition` type. Add `getByCode`.
6. `catalogShipped.test.ts`: every entry has a code matching `/^E\d{3,}$/`; codes unique; none in `codes.json` retired; every code below `next`.
7. `npm run endgames:build` then `npm run endgames:verify`. Exit 0. Only `code` changes in `endgames.json`; diff to prove it.
8. Add to CLAUDE.md under a new "Endgame catalog" heading: "Each position has a permanent `code` (E###). To delete one, remove it from `scripts/endgames/sources.json` and add its code to `retired` in `scripts/endgames/codes.json`. New positions take `next`. Never renumber." (Rule 13: the deletion workflow is the counterpart of the ID.)
9. Red before green: duplicate one code by hand, show the test and the build fail, revert.

## Part 2 — Labels (tier: unit + e2e, ~10 min)

1. `displayNameFor`: name if present, else `code`. "Position N" is gone.
2. `cardLabelFor` is removed. `EndgameCard` shows `code` on the first line (monospace bold, as target frame 2), the name on its own truncated line when present, then the side-to-move line.
3. Position screen title: name with `code` beside it in small grey monospace, or just `code`. Target frames 4–5.
4. Update e2e tests that matched "Position N" or "#N".

## Part 3 — Search order (tier: unit + e2e, ~10 min)

1. `search` results sorted by piece count ascending, then `code`.
2. `EndgamesHome`: group results under size headings in `SIZE_BUCKETS` order, skipping empty sizes. Heading style as target frame 3. Keep the "N matches" line above.
3. Unit test: searching "rook" returns piece counts in non-decreasing order. E2E: the first heading under a "rook" search is "3 to 5 pieces".

## Part 4 — Favorites (tier: unit + e2e, ~25 min)

1. `localStore.ts`: `getFavorites(): string[]`, `setFavorites(codes: string[])`, key `blindfoldFavorites`, try/catch like the others.
2. A small store slice or hook `useFavorites()` returning `codes`, `isFavorite(code)`, `toggle(code)`. Every screen re-renders on toggle (rule 13: a write needs a refresh).
3. `EndgamesHeader`: optional `right` slot. Position screen passes a 44px star button. `aria-label` "Add to favorites" / "Remove from favorites", `aria-pressed`.
4. `EndgameCard`: filled star badge top-right of the MiniBoard when favorite.
5. `EndgamesHome`: "Favorites" row above "BY SIZE" in the same card style as the size rows, with star icon, "Positions you starred", count of favorites that exist in the catalog, chevron.
6. New view `favorites` in `EndgamesScreen` and new `EndgamesFavorites.tsx`. Back from favorites → home. Back from a position opened from favorites → favorites (track where the position was opened from; size and search keep their current back behaviour).
7. "Random favorite" picks among existing favorites. Hidden when there are none.
8. Use lucide-react `Star` (lucide-react is already used, e.g. `EndgamesHeader.tsx` imports `ArrowLeft`). Filled: `fill="currentColor"`.
9. Tests:
   - Unit: toggle adds and removes; unknown codes are ignored in the count; storage failure does not throw.
   - E2E: star a position → back → its card shows the star → home shows "Favorites 1" → open Favorites → the card is there → open it → unstar → back → Favorites is empty with the empty-state text. Reload the page between starring and checking, to prove it persists.
   - Red before green: break `setFavorites` (no-op), show the reload check fail, restore.
10. UI check (rule 11): overlap scan on the favorites screen and the position header with the star, iPhone portrait and landscape.

## Part 5 — Screenshots and finish (tier: full suite once, ~5 min)

1. Write to `test-results/`: `endgames-home-favorites.png`, `endgames-size-ids.png`, `endgames-search-rook.png`, `endgames-position-unstarred.png`, `endgames-position-starred.png`, `endgames-favorites.png`, `endgames-favorites-empty.png`, iPhone size; plus `endgames-favorites-dark.png`.
2. `npm run test:all` once, then the `webkit-iphone` project once.
3. `git add -A && git commit -m "Endgames: permanent position codes, search sorted by size, favorites"`.
4. Do NOT push.

## Report

Starting and ending SHA. Code range assigned (E001–E274). PROVEN with each red-before-green. UNVERIFIED: real phone, and how it looks to Ashish. Never "done".

## Checklist notes

1. No parked questions.
2. Claims cite file and line.
3. Shipped-catalog tests read the real JSON. Favorites e2e reloads the real page.
4. Tiers and times stated.
5. Red before green in Parts 1 and 4.
6. All of it is worth the run; Ashish asked for each item.
7. Visible decisions at the top.
9. Checked: memory, this conversation, the repo zip.
10. No live data steps (codes only; verify reuses the cache).
11. Overlap scans on new screens.
13. Counterparts: code ↔ deletion workflow in CLAUDE.md and `codes.json`; favorite write ↔ every grid and the home count refresh; favorites view ↔ its back path.
14. States: starred, unstarred, empty favorites, named and unnamed cards, search headings, dark mode.
