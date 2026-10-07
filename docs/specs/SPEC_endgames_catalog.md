# SPEC — Endgame practice: rebuild the catalog, organize by size

Version 2. Written 2026-10-07 09:55 PT. Adds the Speed section.
Target file: `docs/targets/endgames.html` (approved mockup v3). It replaces v2. Match it.
Ends at commit. Do not push. Do not deploy.

## Why this round exists

The purpose of this mode is blindfold practice on smaller boards. It is not endgame theory.
A player who is not ready for 32 pieces picks 5, 10 or 15 instead.
Both colours matter equally. Playing Black means reading the board reversed.

The shipped catalog (9b5e3cc) fails that purpose. 275 of 284 positions come from en.wikipedia.org.
82 are one material balance (KRP v KR). Many are the same diagram shifted to other files.
Every position has 7 pieces or fewer.

## What was checked before writing this

Source: Ashish's zip `blindfold-chess_source_2026-10-07_084035.zip` (no `.git` inside).

- `src/data/endgames.json`: 284 entries. Hosts: en.wikipedia.org 275, lichess.org 7, en.chessbase.com 2. Computed from the file.
- Material keys: 29 distinct. Top: KRP v KR 82, KP v K 50, KBN v K 28. Computed from the file.
- Names: "Vancura position" 18 times, "Philidor position" 14, "Lucena position" 9. Computed from the file.
- Catalog code: `src/services/endgames/catalog.ts` (`materialKey` :60, `groupLabel` :101, `family` :119, `pieceList` :133, `search` :169, `randomFrom` :185, `getById` :190). `catalogGroups.ts` (`sideToMove`, `familyOf`, `groupsForFamily`, `groupEntries`, `displayNameFor`).
- UI: `src/components/endgames/` holds `EndgamesHome.tsx`, `EndgamesFamily.tsx`, `EndgamesPosition.tsx`, `EndgamesHeader.tsx`, `GoalPill.tsx`. Screen shell `src/components/screens/EndgamesScreen.tsx`.
- Goal is shown at `EndgamesHome.tsx:110`, `EndgamesFamily.tsx:54`, `EndgamesPosition.tsx:36`, `GameOverPanel.tsx:48`.
- Tests: `src/services/endgames/catalog.test.ts` (shipped-catalog checks from :115, 7-piece cap at :119, source cap at :172). `tests/e2e/endgames.spec.ts` (Rook endings path :51, family view in game-over test :118, back arrows :159, overlap scans :203–214, screenshots :237–269).
- `scripts/endgames/verify.mjs` (94 lines): tablebase check with `.ovh` then `.org` fallback.
- `public/engine/stockfish.js`: a Stockfish JS build (GPL v3, 48 lines minified). Not loaded by the app today.
- Commands, ports and Playwright setup are unchanged from SPEC_endgames.md: `npm run test:unit`, `npx playwright test <file>`, `npm run test:all`, preview on 4190.
- SPEC_CHECKLIST.md rules 1–14 and the 2026-10-04 additions: checked. Notes at the end.

## Decisions you will see

1. Endgames screen offers four sizes: 3 to 5, 6 to 8, 9 to 11, 12 to 16 pieces. Counts include kings and pawns.
2. Size screen groups positions by type of ending (Pawn, Rook, Minor piece, Queen, Mixed). Empty types are not shown.
3. Each row shows side to move and the exact piece count. No Win or Draw tags anywhere.
4. Position screen: header is the size, subtitle the type. Line reads "You play White. 5 pieces."
5. "Another from this group" becomes "Another of this size", on the position screen and the game-over panel.
6. Game-over panel loses the "Goal was a win/draw" line.
7. Game-over "Endgames" returns to the size screen of the position just played.
8. Search placeholder: "Search: rook, Lucena, opposite bishops…". Matches show their size.
9. Roughly half the positions in every size are Black to move.
10. Everything else stays as built in the last round.

## Decisions made for you (not visible)

- Positions are FOUND, never invented. Every FEN is extracted by a script from machine-readable source data. No FEN is typed by hand or read off an image by a model.
- Allowed source data: PGN with a `[FEN]` header (Lichess study export `https://lichess.org/api/study/{id}.pgn` and similar), full game PGNs (the position after a stated ply), and Wikipedia `{{Chess diagram}}` templates read from the raw wikitext (`?action=raw`).
- For Wikipedia diagrams, side to move must be stated in the caption ("White to move", "Black to play" and similar). No statement, no entry.
- Positions from real games are welcome for the larger sizes. Pick the ply. Choosing a Black-to-move ply is the preferred way to get Black positions.
- Colour flip is allowed, as a last resort for balance. A flip mirrors the board top to bottom AND swaps colours AND swaps side to move. Never change only the side to move.
- The `goal` field is removed.

## Worth the run

All of it. Parts 1–2 are the point. Part 3 is the screen change you approved. Part 4 updates tests the change breaks.

## Speed (this machine is a new M5 MacBook Air)

- Sourcing: run it as parallel subagents, one per size bucket (4 agents). Each writes its own manifest fragment. Merge into `sources.json` before the build. Check the merged file for near-copies across fragments.
- Stockfish checks: run one Stockfish process per CPU core minus one (`os.availableParallelism() - 1`), each at 1 thread. Tablebase calls stay one at a time, as now.
- Playwright: `WORKERS = 2` in `playwright.config.ts:23` was sized for the old Mac. Try 4 for this session's runs. If any engine-lifecycle or engine-wait test times out at 4, drop to 3, then back to 2. Commit whichever value passed the full suite cleanly, and update the comment above it with the new machine and result.

---

## Part 0 — Start (tier: none, ~1 min)

1. `git status` clean, else stop and report.
2. Branch `main`.
3. `git merge-base --is-ancestor 9b5e3cc HEAD` must succeed. Record `git rev-parse --short HEAD`.

## Part 1 — Catalog pipeline (tier: unit + live data, ~50 min with parallel agents)

### 1a. Manifest is the source of truth

`scripts/endgames/sources.json`. One record per catalog entry:

```ts
{
  id: string;                 // stable slug
  name: string | null;        // only if the source names it
  themes: string[];           // lowercase words, may be empty
  source: { title: string; url: string };   // url = the page a human can open
  extract:
    | { kind: "pgn-fen"; pgnUrl: string; chapter: number }          // [FEN] header of chapter N
    | { kind: "pgn-ply"; pgnUrl: string; game: number; ply: number } // position after ply N of game N
    | { kind: "wiki-diagram"; page: string; index: number; sideToMove: "w" | "b" };
  flip: boolean;              // default false
}
```

`sideToMove` for wiki diagrams is copied from the caption. The build script checks the caption text contains the matching phrase, and rejects the record if not.

### 1b. Build script: `scripts/endgames/build.mjs`

- Fetches each source, extracts `sourceFen`, applies `flip` if set, writes `src/data/endgames.json`.
- Caches fetched pages under `scripts/endgames/.cache/` (add to `.gitignore`). Re-runs are offline.
- Output entry: `{ id, fen, sourceFen, flipped, name, themes, source }`. `goal` is gone.
- All FENs normalized: castling `-`, en passant `-`, halfmove `0`, fullmove `1`.
- Add `"endgames:build": "node scripts/endgames/build.mjs"`.

### 1c. The flip function: `src/services/endgames/mirror.ts`

`mirrorColors(fen)`: rank 8 becomes rank 1 and so on. Uppercase becomes lowercase and back. Side to move swaps. Files do NOT change.

The build script imports the same logic (share it, or keep a byte-identical copy checked by a test). One implementation, not two that can drift.

### 1d. Verify script: extend `scripts/endgames/verify.mjs`

Every check below runs on every entry. Exit 1 on any failure. Print a summary table.

1. Re-extract `sourceFen` from the cached source. It must equal the stored `sourceFen` exactly.
2. `fen === (flipped ? mirrorColors(sourceFen) : sourceFen)`.
3. chess.js accepts `fen`. Game not already over. Side not to move is not in check.
4. Not lost for the side to move:
   - 7 pieces or fewer: tablebase category must not be `loss`, `maybe-loss` or `blessed-loss`.
   - 8 or more: Stockfish evaluation for the side to move must be at least −1.5 pawns, depth 16. Use `public/engine/stockfish.js` under Node if it runs. If it does not, add the `stockfish` npm package as a devDependency and use that. Do not ask.
5. For every flipped entry: the evaluation of `fen` (side to move's view) must be within 0.3 pawns of the evaluation of `sourceFen`. For 7 pieces or fewer, the tablebase categories must match. This proves the flip kept the position's meaning.
6. Write `scripts/endgames/verify-report.md` with one line per entry: id, size, side to move, eval or category, flipped. Commit it.

Live data step reason (rule 10): this writes the catalog.

### 1e. Catalog rules, enforced in `catalog.test.ts` on the shipped JSON

- Total 260–320.
- Size buckets: 3–5: 60–80. 6–8: 70–90. 9–11: 60–80. 12–16: 50–70. No entry above 16 pieces or below 3.
- Black to move: 40–60% in EVERY bucket.
- Flipped entries: at most 25% of the catalog, and at most 35% of any bucket.
- Sources counted by HOST (`new URL(url).host`). At least 5 hosts. None above 40%.
- Each material key: at most 8 entries.
- Each `name`: at most once.
- No near-copies. For every pair of entries, none of these may match: identical placement; one is a file-shift of the other; one is a left-right mirror of the other; one is `mirrorColors` of the other. Compare placement only.
- Every entry: `fen` is a legal FEN with no castling and no en passant, and `fen === (flipped ? mirrorColors(sourceFen) : sourceFen)`.
- Every family appears in at least three of the four buckets.

### 1f. Unit tests for the flip (`mirror.test.ts`)

- Three hand-written pairs, each checked against a board drawn in a comment. One must include pawns on both sides and Black to move.
- `mirrorColors(mirrorColors(f)) === f` for every catalog FEN.
- For every catalog FEN: legal move count is equal before and after flipping.
- For every catalog FEN: piece counts by type swap colours exactly.
- A pawn on rank 2 for White becomes a Black pawn on rank 7.

Red before green (rule 5): break `mirrorColors` (swap colours but not ranks), show the tests fail, revert. Break one catalog entry's `fen` so it no longer matches its `sourceFen`, show the shipped-catalog test fail, revert.

Pre-answered:
- A source position is lost for the side to move: drop it. Do not flip it into shape.
- A bucket is short of Black positions: first add game positions at Black-to-move plies. Flip only if still short.
- Two sources give the same position: keep the one that names it.
- A diagram's caption is ambiguous about side to move: drop it.
- 12–16 piece positions are hard to find in collections: take them from real game PGNs.

## Part 2 — Catalog code (tier: unit, ~15 min)

- `sizeOf(fen)`: total pieces including kings and pawns.
- `SIZE_BUCKETS`: `[3,5]`, `[6,8]`, `[9,11]`, `[12,16]`, labels "3 to 5 pieces" and so on, subtitles as target frame 2.
- `bucketOf(entry)`, `entriesByBucket`, `countsByBucket`, `familiesInBucket(bucket)` returning families in `FAMILY_ORDER` with entries, empty ones left out.
- "Position N" numbering: among unnamed entries of the same bucket and family, in file order.
- `search` also matches the bucket label.
- Remove `goal` from types and from all code. Delete `GoalPill.tsx`.
- Update unit tests for all of the above.

## Part 3 — Screens (tier: unit + e2e, ~25 min)

Match `docs/targets/endgames.html` v3 frames 1–7.

- Home: size list replaces family list. "BY SIZE" label.
- Rename `EndgamesFamily.tsx` to `EndgamesSize.tsx`. Header is the bucket label, subtitle "N positions". Groups by family. Rows show side to move and a right-aligned piece count. Random button reads "Random, 3 to 5 pieces" and so on.
- Position: header bucket label, subtitle family label. "You play White. 5 pieces." "Another of this size" picks from the same bucket, excluding the current.
- Game over: remove the goal line. "Another of this size". "Endgames" lands on that position's size screen.
- Search rows: subtitle "3 to 5 pieces. Black to move", piece count on the right.
- Every back arrow: position → size → home → menu.

Counterparts (rule 13): removed `goal` → no references left (`grep -rn "goal" src/` returns only unrelated hits; list them in the report). Renamed screen → App routing and game-over landing both updated.

## Part 4 — Tests (tier: e2e, ~15 min run)

Update `tests/e2e/endgames.spec.ts`:
- The play test goes Home → "3 to 5 pieces" → first named entry → Play Blindfold → one move → reply.
- The Black test picks a Black-to-move entry from "12 to 16 pieces", so the reversed board is exercised on a full-looking position.
- Game-over test: "Endgames" lands on the size screen.
- Back-arrow test: position → size → home → menu.
- Overlap scans and screenshots: same as before, on home, size and position views. Screenshot names: `endgames-home.png`, `endgames-size.png`, `endgames-position.png`, `endgames-position-black.png` (a Black-to-move position, board shown from Black's side), `endgames-position-dark.png`, `endgames-search-empty.png`, `endgames-gameover.png`.

The offline test needs no change unless a selector broke. Fix selectors only.

Iterate with `npx playwright test tests/e2e/endgames.spec.ts`. Full suite once at the end.

## Part 5 — Finish (tier: full suite once, ~5 min)

1. `npm run endgames:build` then `npm run endgames:verify`. Exit 0.
2. `npm run test:all` once.
3. Close backlog item `bc-l36bsz` in the same commit.
4. `git add -A && git commit -m "Endgames: rebuild catalog from extracted sources, organize by size"`.
5. Do NOT push.

## Report

- Starting and ending SHA.
- Playwright worker count committed, and why.
- Catalog: total; per bucket with Black-to-move share; flipped count per bucket; hosts and shares; largest material key count.
- The verify summary table (totals only; the full list is in verify-report.md).
- PROVEN, with each red-before-green.
- UNVERIFIED. At minimum: how the screens look to Ashish, and any check that could not run.
- Never say "done".

## Checklist notes (SPEC_CHECKLIST.md)

1. Pre-answered stops listed in Part 1. Only stop: dirty tree or wrong base.
2. Every claim cites a file, line, or a count computed from the shipped file.
3. Catalog tests read the shipped JSON. Verify re-extracts from the real sources, not from our own output.
4. Tier and time on every part.
5. Red before green in Part 1f.
6. Worth the run stated.
7. Visible decisions at the top.
9. Checked: memory, this conversation, the repo zip, the web (tablebase API format).
10. One live step (Part 1d), reason given.
11. Overlap scans extended to the renamed size screen.
12. The fix is done, not measured.
13. Counterparts in Part 3.
14. States in target frames 1–7. Empty family in a bucket: hidden (decision 2).
