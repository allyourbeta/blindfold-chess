# SPEC — Local "Add a position" page, and a password-protected Remove button in the app

Version 1. Written 2026-10-16 17:10 PT.
Ends at commit. Do not push. Do not deploy. Do not create tokens or set Vercel env vars (Ashish does that; Part 6 lists the steps for the report).

## What was checked before writing this

Source: `blindfold-chess_source_2026-10-16_162859.zip` (HEAD 1c925f1).

- `npm run pos -- add|delete|list` exists: `scripts/endgames/pos.mjs` (I/O) and `scripts/endgames/positions.mjs` (pure `addEntry` / `deleteEntry` / `listEntries`), near-copy logic in `scripts/endgames/nearCopy.mjs`. Recognition via chessdirbek `POST http://localhost:8000/api/ocr`, which auto-rotates Black-side diagrams but can guess wrong on diagrams without coordinates.
- The catalog the app reads is the committed file `src/data/endgames.json`, imported at build time (`src/services/endgames/catalog.ts`). Deleting an entry needs no tablebase call: remove it from `sources.json` and `endgames.json`, retire the code in `codes.json`.
- Every push to `main` deploys on Vercel (this is how Ashish deploys today).
- `vercel.json` rewrites every path to `/index.html` and has no `api/` directory yet.
- Favorites already use a localStorage-backed zustand store (`src/state/favoritesStore.ts`); same pattern fits a "removed codes" list.
- Places a position is shown: `src/components/endgames/EndgamesPosition.tsx` (before playing) and `src/components/play/GameOverPanel.tsx` (after a game). Confirm in source which state tells GameOverPanel the game came from a catalog entry, and its code.
- `docs/SPEC_CHECKLIST.md`: checked. Notes at the end.

## Decisions you will see

**Local page (laptop only)**
1. `npm run pos -- page` starts a page on your laptop and opens it in the browser. Match `docs/targets/TARGET_pos_page.html`, using the app's real piece images.
2. Paste (⌘V) or drop a board image. The board appears with file letters and rank numbers.
3. "White to move" and "Black to move" set whose turn it is. They do not turn the board.
4. "Flip board" fixes a diagram read from the wrong side: the pieces stay where they are on screen, the coordinates reverse, and the stored position changes to match.
5. The FEN box is editable; the board follows it.
6. A status line says whether the position is legal, quiet, and not a duplicate. "Add as E2xx" adds it, then commits and pushes, and the page shows the result.
7. The page has no list and no delete. Deleting happens in the app.

**In the app**
8. Visiting `blindfol.de/#creator` on a device asks for your password once. After that, that device shows a Remove button. Visiting `#creator` again offers "Lock this device".
9. Remove appears on the position screen and on the end-of-game panel for catalog positions. Nowhere else, and never on a locked device.
10. Remove asks "Remove E2xx from the app for everyone?" On yes: the position disappears from that device at once, the screen goes back to the list, and a note says it will be gone everywhere in about a minute.
11. Other users never see Remove or the unlock prompt.

**Both**
12. The local page and `npm run pos` first pull the latest `main`, so a removal made from your phone never blocks your next add.

## Part 0 — Start (~1 min)

Record `git rev-parse HEAD`. Tree must be clean. Read the files named above before editing.

## Part 1 — Shared I/O refactor (tier: unit, ~10 min)

1. Split `pos.mjs` so the add flow is a function (`addFromPlacement({ placement, sideToMove })`) usable by both the CLI and the page server, returning `{ code, result }` or throwing a plain-language error.
2. Add `git pull --ff-only` at the start of every write path (CLI add/delete, page add). If it fails (dirty tree, diverged), stop with: "Couldn't update from GitHub. Commit or stash your changes first."
3. Add a pure `rotate180(placement)` to `positions.mjs`. Unit test it (round trip, a known example). Show it red first.

## Part 2 — Local page (tier: unit + one live run, ~20 min)

1. `npm run pos -- page`: a small Node HTTP server on `127.0.0.1:5199` (bind localhost only), opens the browser.
2. Endpoints, all local: `POST /recognize` (image → chessdirbek → placement; same "Start chessdirbek first" message when it's down), `POST /check` (dry-run `addEntry` → ok or the reason), `POST /add` (calls `addFromPlacement`, returns code and result or the error).
3. Page: match the target file. Pieces from `public/pieces/*.svg` served by the same server. Paste and drop both supported. Flip board = `rotate180` plus reversing the view, so pieces stay visually put. Side toggles never change the view. The view on load follows side to move.
4. Live run: start the page, paste an image if chessdirbek is running (else type a FEN), check the board, coordinates and Flip, run `/check`, do not add. Screenshot to `qa/pos-page.png`.

## Part 3 — Remove API (tier: unit with fakes, ~15 min)

1. `vercel.json`: change the rewrite source so `/api/*` is not sent to `index.html` (for example `"/((?!api/).*)"`).
2. `api/positions/verify.ts`: `POST` with `Authorization: Bearer <password>`. 200 if it matches env `POS_PASSWORD` (constant-time compare), else 401. If `POS_PASSWORD` is unset, always 401.
3. `api/positions/remove.ts`: `POST {code}` with the same header. On a valid password: read `scripts/endgames/sources.json`, `scripts/endgames/codes.json`, `src/data/endgames.json` from `main` via the GitHub API (env `GITHUB_TOKEN`, `GITHUB_REPO`), apply `deleteEntry` and filter `endgames.json`, write all three in **one** commit (Git Data API: blobs → tree → commit → update ref), message `Endgames: delete E2xx (from app)`. On a ref conflict, re-read and retry once. Unknown code → 404. Missing env → 500 with a plain message. Never log the password or token.
4. Put the commit-building logic in a pure function that takes a small GitHub client interface. Unit tests use a fake client and fixture files copied from git at the Part 0 SHA: success writes one commit with all three files changed correctly; wrong password → 401 and no writes; unknown code → 404; one retry on conflict. Show one red first.
5. If `vercel` CLI and a linked project are available, run `vercel build` (local only, no deploy) to confirm the functions compile. Otherwise mark UNVERIFIED.

## Part 4 — Remove in the app (tier: unit + endgame e2e, ~15 min)

1. `src/state/creatorStore.ts`: localStorage-backed; holds the password when unlocked. `#creator` handling: prompt, call `/api/positions/verify`, store on 200, show "Wrong password" on 401; when already unlocked, offer "Lock this device".
2. `src/state/removedStore.ts`: localStorage list of codes removed from this device. `catalog.ts` filters `ENDGAMES` by it in one place, so every screen agrees. Codes no longer in the shipped catalog are pruned from the list.
3. Remove button and confirm on `EndgamesPosition.tsx` and `GameOverPanel.tsx` (catalog games only), shown only when unlocked. On success: add to removed list, navigate to the endgames list, show the note from decision 10. On failure: show the server's message; change nothing locally.
4. Tests: unit for both stores. e2e (route-mock the API): no Remove when locked; `#creator` with right password unlocks; Remove → confirm → position gone from the list and the note shown; wrong password shows the error. Run the five endgame e2e files plus the new one.

## Part 5 — Finish (tier: full suite once, ~10 min)

1. Update `CLAUDE.md` "Adding endgame positions": add `npm run pos -- page`, and a line on removing from the app via `#creator`.
2. `npm run test:all`, once.
3. Commit: `Endgames: local add page, password Remove in the app`.

## Part 6 — Report

PROVEN / UNVERIFIED. Include, as plain steps for Ashish (do not perform them):
- Create a fine-grained GitHub token for the repo `<owner/repo from git remote>` with Contents: read and write only.
- `vercel env add GITHUB_TOKEN production`, `vercel env add GITHUB_REPO production` (value `<owner/repo>`), `vercel env add POS_PASSWORD production`.
- Then `git push`, open `blindfol.de/#creator` on the phone, enter the password.

Also list: screenshot path, whether `vercel build` ran, and each test file added.

## Checklist notes

1: no parked questions; flip semantics, unlock flow, placement of Remove and the pull-first rule are decided here. 2: claims cite files. 3: fixtures from real files at the start SHA. 4: tiers and times per part. 5: red-first in Parts 1 and 3. 7: decisions at the top. 8: target file in `docs/targets/`. 10: one screenshot of the page. 13: counterparts — the in-app removal and the laptop add both go through `deleteEntry`/`addEntry`; the pull-first rule covers the divergence the phone removal creates; `vercel.json` changes with the new `api/` routes.
