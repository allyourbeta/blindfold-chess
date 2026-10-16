# SPEC — One laptop command to add, delete and list endgame positions

Version 1. Written 2026-10-16 16:10 PT.
Ends at commit. Do not push. Do not deploy.
This replaces `SPEC_endgames_black_to_move.md` (zip 83). Its five positions are seeded here.

## What was checked before writing this

Sources: `blindfold-chess_source_2026-10-16_142137.zip` (HEAD fad06da) and `chessdirbek_source_2026-10-16_154735.zip`.

- Catalog pipeline: `scripts/endgames/sources.json` → `npm run endgames:build` (`scripts/endgames/build.mjs`) → `src/data/endgames.json`. Codes in `scripts/endgames/codes.json` (`next` 286, `retired` E001–E274). Hand-picked entries use `extract.kind: "fen"` (`CLAUDE.md`, "Adding endgame positions").
- Build fetches Lichess tablebase results for 7 pieces or fewer (`build.mjs:31–47`), so add/delete needs network.
- Data invariant tests: `src/services/endgames/catalogShipped.test.ts` and `catalogShippedResults.test.ts` (legal, quiet, unique codes, retired, no near-copies). They take seconds.
- Script tests live under `src/` and import `.mjs` directly (pattern: `src/services/endgames/quiet.test.ts:4`). Vitest includes only `src/**/*.test.ts` (`vite.config.ts:66`).
- Chessdirbek recognition: `POST http://localhost:8000/api/ocr` with `{image_base64}` returns `{fen, orientation}` (`chessdirbek backend/api/ocr.py`). It auto-rotates boards drawn from Black's side (`ocr_service.py:184–189`), so the returned FEN is already in normal orientation. It does not know whose move it is. Status at `GET /api/ocr/status`. Port 8000 (`run.sh`).
- Phone updates: the service worker fetches pages network-first (`public/sw.js:167–172`) and app bundles are content-hashed, so a deploy reaches the phone on its next online load. No cache-version bump needed for data changes.
- Black-to-move boards already start from Black's side. No app code changes in this spec.
- I ran `isQuiet` and chess.js on the five seed FENs below with Black to move: legal, quiet, not over, no near-copy of an existing entry.
- `docs/SPEC_CHECKLIST.md`: checked. Notes at the end.

## Decisions you will see

1. A new terminal command, `npm run pos`, with three actions: `add`, `delete`, `list`.
2. `add` reads an image (a file path, or the clipboard if no path is given), recognizes it with chessdirbek, and opens a preview of the board in your browser. The terminal then asks you to confirm.
3. `add` defaults to White to move. Add `--black` for Black to move. The preview shows the board from the side to move.
4. `add --fen "<placement>"` skips recognition, for when you already have a FEN.
5. `delete E287` opens the same preview and asks you to confirm.
6. After you confirm, the command builds the catalog, runs the fast data checks, commits, and **runs `git push`**. Your confirmation is the deploy. Nothing else is pushed except commits already on your branch.
7. The command refuses, with a plain reason, when: chessdirbek isn't running; the position is illegal, already over, or not quiet; it's a near-copy of an existing position; or the code to delete doesn't exist.
8. The five Black-to-move positions you sent earlier are added as E286–E290.
9. Nothing in the app itself changes.

## Usage (goes into CLAUDE.md, replacing the "Adding endgame positions" section)

```
npm run pos -- add [image.png] [--black]
npm run pos -- add --fen "<placement>" [--black]
npm run pos -- delete E287
npm run pos -- list
```

## Part 0 — Start (~1 min)

Record `git rev-parse HEAD`. Tree must be clean. If zip 83's spec was already executed (E286–E290 present in `src/data/endgames.json`), skip Part 3.

## Part 1 — Pure logic, tested (tier: unit, ~15 min)

Create `scripts/endgames/positions.mjs`. Pure functions, no I/O:

- `addEntry(manifest, codes, { placement, sideToMove })` → `{ manifest, codes, code }`. Validates legal, not over, quiet (`quiet.mjs`), no near-copy of any existing placement (reuse the near-copy logic from `catalogShipped.test.ts`; move it into a shared `.mjs` and have the test import it so there is one copy). Assigns `codes.next`, bumps it. Entry shape matches existing hand-picked entries: `id` lowercase code, `name: null`, `themes: []`, no source, `extract: { kind: "fen", placement, sideToMove }`.
- `deleteEntry(manifest, codes, code)` → `{ manifest, codes }`. Removes the entry, appends the code to `codes.retired`. Throws on an unknown code.
- `listEntries(manifest)` → rows of code, side to move, piece count.

Tests in `src/services/endgames/positions.test.ts`, using a small fixture manifest (copy two entries from `scripts/endgames/sources.json` at the Part 0 SHA). Never read the shipped catalog. Cover: add assigns next code; add rejects illegal, over, non-quiet, near-copy; delete retires the code; delete of unknown code throws; a deleted code is never reassigned. Show one test red first.

## Part 2 — The command (tier: unit for helpers + one live manual run, ~20 min)

Create `scripts/endgames/pos.mjs`, wired as `"pos": "node scripts/endgames/pos.mjs"` in `package.json`.

1. `add`:
   - Image source: the path argument, else the macOS clipboard image (write it to a temp PNG via `osascript`; if the clipboard holds no image, say so and stop).
   - Check `GET http://localhost:8000/api/ocr/status` first. If unreachable or `models_present` is false, print "Start chessdirbek first (http://localhost:8000)." and stop.
   - `POST /api/ocr`, take the placement from the returned FEN.
   - Preview: write a temp HTML page drawing the board with the app's own piece files (`public/pieces/*.svg`, absolute file paths), oriented from the side to move, with the FEN and the proposed code printed under it. Open it with `open`.
   - Terminal prompt: `Add as E2xx (White|Black to move)? [y/N]`. Anything but `y` stops without changes.
2. `delete <code>`: same preview of the entry being removed, prompt `Delete E2xx? [y/N]`.
3. `list`: print the rows from `listEntries`.
4. After a confirmed add or delete: write `sources.json` and `codes.json`; run `npm run endgames:build`; run only `npx vitest run src/services/endgames/catalogShipped.test.ts src/services/endgames/catalogShippedResults.test.ts`; on any failure, restore both files and the built catalog from git and stop with the error. On success: `git add` only `scripts/endgames/sources.json scripts/endgames/codes.json src/data/endgames.json`, commit `Endgames: add E2xx` or `Endgames: delete E2xx`, then `git push`. Print the result.
5. Live check, once: run `add --fen "8/4k3/8/4K3/8/4P3/8/8"`, check the preview opens, answer `n`, and verify nothing changed. Then, if chessdirbek is running on this machine, screenshot that preview page to a PNG and run `add <that png>`, answer `n`, and confirm the recognized placement matches. If chessdirbek is not running, record recognition as UNVERIFIED and check the "Start chessdirbek first" message instead.

## Part 3 — Seed the five Black-to-move positions (tier: build + data tests, ~3 min)

Use `addEntry` (not the interactive command) in a one-off run, in this order, all `sideToMove: "b"`:

| Code | FEN placement |
|---|---|
| E286 | `4k3/ppp5/2b5/8/8/1B6/1P6/4K3` |
| E287 | `4k2r/ppp4p/8/8/8/8/PPP4P/4K2R` |
| E288 | `4k3/ppp5/8/8/8/8/PPP5/4K3` |
| E289 | `8/6k1/6p1/8/2p1r3/7R/8/2K5` |
| E290 | `R7/P7/5k2/2K5/8/8/8/r7` |

Run `npm run endgames:build`, then the two data test files. E287 and E288 get `result: null` (8+ pieces). Retry the tablebase once if unreachable; never hand-write results.

## Part 4 — Finish (tier: endgame e2e files, then full suite once, ~15 min)

1. Run the five `tests/e2e/endgames*.spec.ts` files. The Black-to-move e2e tests now switch on for the first time. If one fails, decide whether the test or the app is wrong; fix a wrong test; fix a wrong app and keep a regression test.
2. Replace the CLAUDE.md "Adding endgame positions" section with the usage block above plus one line: "Chessdirbek must be running for image recognition."
3. `npm run test:all`, once.
4. Commit: `Endgames: pos command (add/delete/list) and five Black-to-move positions`. Do not push.

## Report

PROVEN / UNVERIFIED. List: the five seeded codes with results; the live-check outcome (Part 2.5); which Black-to-move e2e tests now run and pass; any test or app fix in Part 4 and why.

## Checklist notes

1: no parked questions; recognition contract, port, rotation and phone update path were checked in source. 2: claims cite files. 3: fixtures come from real `sources.json` entries. 4: tiers and times per part. 5: Part 1 shows red first. 7: decisions at the top. 9: one live run of the real recognizer if available. 13: counterparts — the near-copy rule moves to one shared module used by both the test and the command; the CLAUDE.md section is updated with the command.
