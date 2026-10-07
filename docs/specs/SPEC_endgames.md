# SPEC — Endgame practice mode

Version 1. Written 2026-10-07 00:20 PT.
Target file: `docs/targets/endgames.html` (approved mockup v2). Match it.
Ends at commit. Do not push. Do not deploy.

## What was checked before writing this

Source: Ashish's source zip `blindfold-chess_source_2026-10-06_231126.zip`.
It has no `.git`, so the starting SHA is not known here. Record it in Part 0.

- Scripts (`package.json`): `typecheck`, `build`, `test:unit` (vitest), `test:e2e` (playwright), `test:all`. Preview runs on port 4190 with `--strictPort`.
- Playwright (`playwright.config.ts:23`, `:35`): 2 workers, baseURL `http://localhost:4190`. Projects: `chromium` and `iphone` (390x844).
- Vitest (`vite.config.ts`, `test.include`): `src/**/*.test.ts` only.
- Engine: Maia only. Stockfish is kept but never created (`src/engine/createEngineManager.ts:8`).
- Player colour comes from settings inside `beginGame` (`src/state/gameFlow.ts:192`). There is no way to override it today.
- Setup games start via `startFromSetup(fen)` (`src/state/gameStore.ts:105`), which calls `flow.beginGame(fen)`.
- If the engine is on move after setup, `beginGame` asks it to move (`gameFlow.ts:229`).
- Screens are a plain union in `src/App.tsx:9`: `"menu" | "setup" | "play"`.
- The menu's "Set up a position" button is at `src/components/screens/MenuScreen.tsx:178`. It is disabled until the engine is ready.
- Game-over panel: `src/components/play/GameOverPanel.tsx`. Buttons New Game, Copy PGN, Menu.
- More sheet "New Game": `src/components/play/ActionBar.tsx` around line 98–108.
- Board component takes a board matrix plus `flipped` (`src/components/board/Board.tsx`). Pieces are the Staunty SVG set in `public/pieces/` (`PieceGlyph.tsx:2`).
- Theme tokens: `src/index.css` `@theme` block and `:root.dark`.
- Offline: the service worker serves non-navigation requests cache-first and caches any 200 it fetches (`public/sw.js:184`). The main JS bundle is cached on first load. A statically imported JSON file rides in that bundle.
- Existing offline test: `tests/e2e/offline.spec.ts` plays a normal game offline.
- Control-overlap scan already exists as `boxesOf` in `tests/e2e/landscape.spec.ts:16`.
- Lichess tablebase API: `GET https://tablebase.lichess.ovh/standard?fen=<FEN>`. Response `category` is from the side to move's view: `win`, `draw`, `loss`, plus `cursed-win`, `blessed-loss`, `maybe-win`, `maybe-loss`, `unknown`. Covers 7 pieces or fewer. Source: github.com/lichess-org/lila-tablebase README.
- CLAUDE.md: Tenzing backlog commands, and the test-economy rule. Both apply here.
- SPEC_CHECKLIST.md: checked, rules 1–14 and the 2026-10-04 additions. Notes are at the end.

## Decisions you will see

1. Menu gets one new button, "Practice an endgame", under "Set up a position".
2. Endgames screen: search box, "Random endgame", five families with counts.
3. Family screen: positions grouped by material. Each row has a Win or Draw tag and the side to move.
4. A position with no known name shows as "Position N" in its group.
5. Position screen: preview board, name, "You play White. Win." line, piece list in text, source line.
6. You always play the side to move. The White/Black setting is ignored in this mode only.
7. Search replaces the family list with matches. No matches shows one line and "Clear search".
8. "Play Blindfold" and every random button are disabled while the engine loads.
9. Game over in an endgame: the result, then "Goal was a win." or "Goal was a draw." Buttons: Try again, Another from this group, Copy PGN, Endgames.
10. In an endgame, the More sheet's "New Game" reads "Try again" and replays the position.
11. Normal games and set-up games keep today's panel and buttons exactly.
12. Positions where the side to move loses are left out of the catalog.

Nothing else on screen changes. If you find yourself changing something not in this list, stop and leave it.

## Decisions made for you (not visible)

- Catalog lives in `src/data/endgames.json`, statically imported. Reason: it then ships inside the cached main bundle, so offline works with no service-worker change.
- Positions are FOUND online, not generated. At least five distinct sources. No single source supplies more than 40% of the catalog. Do not copy one book's collection.
- Every position is checked against the Lichess tablebase before it enters the catalog. Its goal comes from that check, not from the source's caption.
- Family is computed from material, never chosen by hand. Rules in Part 1.
- Opponent is Maia at the player's current settings. No engine change.

## Worth the run

All parts are worth it. This is one feature and its tests. There is no polish item here to cut.

---

## Part 0 — Start (tier: none, ~1 min)

1. `git status` must be clean. If not, stop and report. Do not stash or commit someone else's work.
2. `git branch --show-current` must be `main`. Record the output.
3. Record `git rev-parse --short HEAD` as the starting SHA in the report.

## Part 1 — Catalog data and its checker (tier: unit + one live data step, ~35 min)

### 1a. Schema

`src/data/endgames.json` is an array of:

```ts
interface EndgamePosition {
  id: string;            // stable slug, e.g. "rook-lucena-1"
  fen: string;           // full six-field FEN, halfmove 0, fullmove 1
  name: string | null;   // only if the SOURCE names it (Lucena, Philidor, Vancura, Réti, …)
  themes: string[];      // short lowercase words from the source, e.g. ["opposition"]; may be empty
  goal: "win" | "draw";  // from the tablebase, side to move's view
  source: { title: string; url: string };  // title is what the screen shows
}
```

Family, material group, side to move and the piece list are DERIVED in code. They are not stored.

### 1b. Derivation code: `src/services/endgames/catalog.ts`

- `materialKey(fen)`: canonical like `KRPvKR`. Stronger side first by material (Q9 R5 B3 N3 P1). Tie: White first.
- `groupLabel(key)`: plain words. `KRPvKR` → "Rook and pawn vs rook". `KPvK` → "King and pawn vs king". `KRvKP` → "Rook vs pawn". Two of a kind → "two pawns", "two bishops". Leave out the kings except for `KPvK`, `KPPvK` style king-and-pawn groups, where "King and pawn" reads naturally.
- `family(key)`:
  - `pawn`: only kings and pawns.
  - `rook`: non-pawn pieces are rooks only.
  - `minor`: non-pawn pieces are bishops and knights only.
  - `queen`: non-pawn pieces are queens only.
  - `mixed`: anything else.
- Family labels and subtitles exactly as the target file frame 2.
- `pieceList(fen, color)`: "Kb8, Rc1, pawn b7." Order K, Q, R, B, N, then pawns. Two or more pawns: "pawns a2, b3."
- `search(query)`: case-insensitive. Split on spaces. Every word must appear in the name, a theme, the group label, or the family label.
- `randomFrom(list, excludeId?)`: never returns `excludeId` when the list has more than one entry.
- "Position N": N is the 1-based index among UNNAMED positions in that group, in file order.

### 1c. Unit tests: `src/services/endgames/catalog.test.ts`

These read the SHIPPED `endgames.json`, not hand-built fixtures (checklist rule 3). For every entry:
- FEN parses in chess.js, and the game is not already over.
- 7 pieces or fewer.
- No castling rights. No en-passant square.
- `id` is unique.
- `source.url` starts with `https://`.
- Total count between 250 and 350.
- Family counts within: pawn 70–90, rook 80–100, minor 50–70, queen 20–40, mixed 30–50.
- No single `source.url` host-plus-path prefix supplies more than 40%. Group by `source.title` if easier, but say which you used.

Plus unit tests for `materialKey`, `groupLabel`, `family`, `pieceList`, `search`, `randomFrom`, and "Position N" numbering, using real catalog entries where possible.

Red before green: break one catalog entry on purpose (illegal FEN), show the test fail, revert. Do the same for one derivation function. Say so in the report.

### 1d. The data step (live, reason: it writes the catalog)

1. Find positions in online collections. Good places to start: Lichess practice and public endgame studies, Wikipedia endgame articles (Lucena, Philidor, Vancura, Réti, Saavedra, opposition, triangulation, wrong bishop), and free endgame articles on major chess sites. Record title and URL for each.
2. Prefer named, instructive, simple positions. Spread across the families per the counts above.
3. Write `scripts/endgames/verify.mjs`. It reads `src/data/endgames.json`, queries the tablebase for each FEN one at a time, with 300 ms between requests. Rules:
   - `win` → goal must be `win`.
   - `draw` → goal must be `draw`.
   - Anything else (`loss`, `cursed-win`, `blessed-loss`, `maybe-*`, `unknown`, HTTP 404) → the entry is rejected.
   - It prints a summary and exits 1 if any entry fails.
   - `--fix` mode rewrites `goal` from the tablebase and drops rejected entries. Use `--fix` while building the catalog.
   - If `tablebase.lichess.ovh` fails to answer, try `tablebase.lichess.org` with the same path.
4. Add `"endgames:verify": "node scripts/endgames/verify.mjs"` to `package.json`.
5. Final state: `npm run endgames:verify` exits 0. Paste its summary in the report.

Pre-answered:
- A source caption says "White wins" but the tablebase says draw: trust the tablebase.
- A position has 8+ pieces: drop it.
- The source gives Black to move but the position is a loss for Black: drop it.
- Duplicate FEN from two sources: keep one, use the source that names it.

## Part 2 — Starting a game with a forced colour (tier: unit, ~10 min)

- `beginGame(fen, opts?: { playerColor?: Color })` in `gameFlow.ts`. When given, it replaces the settings colour at line 192. Settings are NOT written.
- Add `activeEndgame: { id: string } | null` to `GameState`. Set by the endgame start path. Cleared by `startNewGame` and `startFromSetup`.
- Add `startEndgame(id)` to the store. It looks up the entry, calls `beginGame(entry.fen, { playerColor: <side to move> })`, sets `activeEndgame`.
- Unit tests in `gameStore.test.ts` / `gameFlow.test.ts`: forced colour wins over settings; settings unchanged afterwards; `startNewGame` after an endgame clears `activeEndgame` and uses the settings colour again.
- Red before green: remove the override for one run, show the forced-colour test fail, restore.

## Part 3 — Screens (tier: unit + e2e, ~30 min)

Match `docs/targets/endgames.html` frames 1–7. Use existing tokens, `Button`, `Card`, `Board`, header pattern from `SetupScreen.tsx`. No new colours, no new fonts.

- `App.tsx`: add `"endgames"` to `Screen`. Pass the menu a new `onEndgames`.
- Menu: new secondary button "Practice an endgame" directly under "Set up a position". Same classes. Disabled until engine ready, same as its neighbour.
- `EndgamesScreen.tsx`: one component with internal views `home | family | position`. Back arrow goes up one view. From `home` it goes to the menu.
  - Accepts an optional starting view, so game-over "Endgames" can land on the family screen of the position just played.
- Position view: preview `Board` of the position, flipped when you play Black. Play Blindfold calls `startEndgame(id)` then goes to `play`.
- "Another from this group" on the position view: random from the same material group, excluding the current one.
- "Random rook ending" (family view): random from that family. "Random endgame" (home): random from all.
- Game over (`GameOverPanel.tsx`): when `activeEndgame` is set, show the frame 7 buttons and the goal line. Otherwise unchanged.
  - Try again → `startEndgame(sameId)`.
  - Another from this group → random from same group, excluding current, start it directly.
  - Endgames → endgames screen, family view of that position.
- More sheet: when `activeEndgame` is set, "New Game" label becomes "Try again" and replays the position.

Counterparts (checklist rule 13):
- Menu button → screen exists and opens. Covered by e2e.
- Every back arrow → returns where expected. Covered by e2e.
- Game-over "Endgames" → lands on the family view. Covered by e2e.
- `activeEndgame` set → cleared by every other way of starting a game. Covered by unit test.

## Part 4 — E2E, offline, and UI check (tier: e2e, ~15 min of run time)

New `tests/e2e/endgames.spec.ts`:
1. Menu → Endgames → Rook endings → the Lucena entry (find it by name; if the catalog has no Lucena, use the first named rook position and say so) → preview shows "You play White." → Play Blindfold → keypad visible → make one legal move → engine replies.
2. A Black-to-move position: confirm the game says "You play Black" while settings say White, and settings still say White afterwards.
3. Search "philidor" (or the first named position's word) shows matches. Search "zzzz" shows "No endgames match" and "Clear search" restores the families.
4. Game over path: start any endgame, then resign via the More sheet. Panel shows "Try again", "Another from this group", "Endgames". Try again restarts the same FEN (check via More → FEN). Endgames lands on the family view.
5. A normal New Game from the menu still shows the old game-over buttons after resign. This guards decision 11.

Offline: add one test to `offline.spec.ts`, same pattern as the existing one. Go offline, open an endgame, play one move, see the reply.

UI check (checklist rule 11): move `boxesOf` from `landscape.spec.ts` into `helpers.ts` and export it. Run it on the endgames home, family and position views at the `iphone` project size and at landscape 844x390. Assert nothing leaves the viewport and no two buttons overlap. Same thresholds as `landscape.spec.ts`.

Red before green: for the overlap check, add a temporary negative margin that pushes one button onto another, show it fail, revert.

Screenshots (rule 8 extension): write these on every run to `test-results/`: `endgames-home.png`, `endgames-family.png`, `endgames-position.png`, `endgames-search-empty.png`, `endgames-gameover.png`, all at the iphone size, plus `endgames-position-dark.png` with dark mode on. Ashish will compare them to the target file.

Iterate narrow: run only `npx playwright test tests/e2e/endgames.spec.ts` while working. Run the full `npm run test:all` once at the end.

## Part 5 — Finish (tier: full suite once, ~5 min)

1. `npm run test:all` once. All green.
2. `npm run endgames:verify` exits 0.
3. Backlog: `tenzing backlog list bc`. Close the endings-mode item and the offline-check item if present, in the same commit. If the command fails, note it and continue.
4. `git add -A && git commit -m "Endgame practice mode: catalog, screens, offline test"`.
5. Do NOT push.

## Report

- Starting SHA and ending SHA. Branch name.
- Catalog: total, per family, number of sources, largest source share, the verify summary.
- PROVEN: each test that passed, and each red-before-green you did.
- UNVERIFIED: anything not shown by a test or screenshot. At minimum: real iPhone offline play, and how the screens look to Ashish.
- Never say "done".

## Checklist notes (SPEC_CHECKLIST.md)

1. No parked questions. Every stop is pre-answered except a dirty tree or wrong branch in Part 0.
2. Claims above cite file and line.
3. Catalog tests read the shipped JSON.
4. Each part names tier and time.
5. Red-before-green named in Parts 1, 2, 4.
6. Worth-the-run stated.
7. Visible decisions are at the top.
9. Checked: memory, past chats, the repo, the web (tablebase API).
10. One live step only, Part 1d, because it writes data.
11. Overlap scan extended to the new screens.
12. Offline is done and tested, not measured.
13. Counterparts listed in Part 3.
14. States shown in target frames 1–7. Engine-loading state is decision 8.
