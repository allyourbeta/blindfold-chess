# SPEC_full_app_audit.md — whole-app walkthrough audit: find every mechanical UI bug, fix, re-walk until clean

Written 2026-10-23 09:30 PT by Claude (planner). Executor: Claude Code. One session, loop until clean, one commit at the end (more commits allowed, see below).

## NO QUESTIONS — read this first
This run must never stop to ask Ashish anything. He is not watching.
- Every open choice: take the default named in this spec. If none is named, take the simplest option that keeps current behaviour and the approved design, and log the choice in the report.
- If a command is denied or fails for environment reasons, use the named alternative below, or skip that step and log it. Never wait.
- Never call a failure "stale" or "flaky" without re-running it once and recording both outputs.

## What Ashish will SEE change
1. During a game's Peek, the board no longer shows the "White's view / Black's view" button (it could never be tapped).
2. Any other fix the audit makes. Every visible change is listed in the report under "Visible changes", one line each, with the screen and before/after. Only mechanical defects may be fixed (list below). No redesigns, no new features, no removed features, no label or wording changes except to fix truncation.

## Starting state
- Source zip 2026-10-23 09:08, HEAD `dc95a69` (round 94, not yet pushed when this was written). Record `git rev-parse HEAD` at start. If HEAD differs, continue anyway and note it.

## Environment facts checked
- Screens: `src/App.tsx:13` `type Screen = "menu" | "setup" | "play" | "endgames"`. Lab sub-views: home, search results, size list, Favorites, position, results panel (`src/components/endgames/`).
- Modals: resign confirm (`ActionBar.tsx:127`), game-over panel (`GameOverPanel.tsx:77`, three variants: normal game, set-up game, endgame), leave-game confirm (`PlayScreen.tsx:116`).
- Peek overlay: `src/components/play/PeekPanel.tsx:27`, wrapper `pointer-events-none`, renders `BoardPanel` with its rotate button.
- Scripts: `npm run build` (`tsc -b && vite build`), `test:unit` (vitest), `test:e2e` (playwright), `test:all`. Playwright serves the built `dist/`: always `npm run build` before targeted e2e runs.
- Projects: `chromium`, `iphone` (390×844), `webkit-iphone` (real WebKit, iPhone 13, limited `testMatch`). `PHONE_USABLE` (393×742) in `tests/e2e/helpers.ts`. Existing shared helper for button boxes: `helpers.ts:190`.
- Existing checks to reuse, not duplicate: `button-fit.spec.ts` (44px, clipping), `raised-controls.spec.ts` (raised/data-flat), `endgames-tap-targets.spec.ts`, `play-layout.spec.ts`, `message-log.spec.ts`, `flicker.spec.ts`.
- Dark mode: `:root.dark` in `src/index.css`; toggle on the menu.
- `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v68'`.

## Part 1 — fix the known bug
`PeekPanel.tsx`: pass `showRotate={false}` to `BoardPanel`. Test: during a peek, no element named "Rotate the board 180 degrees" is visible. Red first.

## Part 2 — build the walkthrough (`tests/e2e/audit-walk.spec.ts`)
Rules for the walker:
- Real UI only: clicks, taps, keypresses, typing. Never call stores, never set state through `page.evaluate`, never read source to decide what to do. `page.evaluate` is allowed ONLY to measure (boxes, computed styles, `elementFromPoint`).
- Never depend on catalog contents: reach positions through the lists; pick "first row", "first position", a search for a piece word.
- Engine: tests may wait for `waitForEngineReady`. Use Maia default; one walk step also selects Stockfish Easy and plays one move.

Viewports × themes, each a separate test: `PHONE_USABLE` light, `PHONE_USABLE` dark, 375×647 light (small iPhone usable area), 742×393 light (landscape). Run on `chromium` and `iphone`; add the file to `webkit-iphone`'s `testMatch` for `PHONE_USABLE` light only.

States to visit (each is a checkpoint):
1. Menu; settings open; each setting changed once and changed back.
2. Position Setup: default; Clear; a piece placed; flip; Black to move; castling toggle; FEN typed and loaded; an invalid FEN loaded (error visible).
3. Play from menu: start; peek (during the 3 s); hint; one move by keypad; promotion or chooser state if reachable in ≤ 6 moves from a set-up position (use setup with a pawn on the 7th); takeback; More menu open; each More item opened and closed; resign confirm; game-over panel.
4. Play from setup: K+B vs K → draw panel → Edit position → setup shows the position.
5. Endgame Lab: home; search "rook" (results); search with no results; a size list; Favorites (empty and with one item: star a position first); a position; Next; Edit; Play Blindfold; resign; endgame results panel; Next from the panel.
6. Leave-game confirm (Back during a game).

At every checkpoint, run all checks:
- **A. Dead controls:** every visible, enabled `button`/`[role=button]`/`a`: `elementFromPoint` at its center returns it or a descendant; its computed `pointer-events` (and every ancestor's) is not `none`. Exempt only `[data-flat="square"]` while the board is non-interactive by design, and anything inside an `aria-hidden` subtree. **Plus:** tap every control at the checkpoint once (then undo by navigation if it moved you) and assert something observable changed (DOM, URL hash, focus, dialog, or class). A control that changes nothing is a defect unless it is disabled.
- **B. Size:** every control ≥ 44×44 px hit box (reuse helper). Visual height ≥ 36 px.
- **C. Clipping/overflow:** no element's text overflows its box (`scrollWidth > clientWidth + 1` or `scrollHeight > clientHeight + 1` on elements with `overflow: hidden`, except the message log which scrolls); no horizontal page scroll; no visible element extends past the viewport's left/right edges.
- **D. Overlap:** no two visible controls' boxes overlap by more than 1 px; no control is covered by a non-control element (`elementFromPoint` check from A covers this).
- **E. Raised:** reuse `raised-controls` logic: raised or `data-flat`.
- **F. Text contrast:** for each visible text node's element, contrast of color vs effective background ≥ 4.5:1 (≥ 3:1 for ≥ 18.66 px bold or 24 px). Compute effective background by walking ancestors; skip elements over images/gradients and log them.
- **G. Stability:** after the checkpoint settles (500 ms), a 1 s MutationObserver window sees ≤ 3 mutations, except during engine thinking or the peek timer.
- **H. Console:** no `console.error` and no uncaught page errors at any checkpoint.

Output: every failure recorded as `{viewport, theme, checkpoint, check, element (label/testid/classes), detail}` and written to `test-results/audit-findings.json` plus a readable `docs/AUDIT_FINDINGS.md` (stamped with date/time and SHA at the top).

## Part 3 — the loop
1. Build, run the walker on the CURRENT code. Record the full findings list (this is the baseline; it is expected to be non-empty).
2. For each finding: if it's a real mechanical defect, fix it at the cause (shared component or token over per-screen patches). If it's a false positive, tighten the check (never widen an exemption without a written reason in the code next to it, and list it in the report).
3. Rebuild, re-walk. Repeat until zero findings, or until three consecutive loops make no progress on the same remaining items — then stop and report those items with full detail. Do not loop more than 8 times.
4. Allowed fixes: sizes, spacing, `shrink-0`/layout constraints, pointer-events, z-index, truncation/wrapping, contrast via existing tokens, missing raised/data-flat, dead or duplicate controls (remove only if it can never work, like the peek button; anything else that does nothing: wire it to its obvious intended action if one exists in the code, else report it, don't remove).
5. Not allowed: changing approved layouts in `docs/targets/`, wording (except truncation), features, colours outside existing tokens. If a mechanical fix would require one of these, leave it, report it under "Needs Ashish".
6. Commit after the baseline run (walker + Part 1 only), and after each loop that fixes something, with messages `audit: loop N — <summary>`. Squashing is not required. The final commit must leave the tree clean.

## Part 4 — keep it permanent
- `audit-walk.spec.ts` stays in the suite and runs in `test:all`.
- `CLAUDE.md`, under testing: "Any UI change must pass `audit-walk.spec.ts` (all viewports/themes). New screens, dialogs or controls get a checkpoint in it in the same commit."
- Bump `CACHE_NAME` → `blindfold-chess-v69`.
- `tenzing backlog add blindfold-chess "Full-app audit walkthrough"` at start; also `tenzing backlog done bc-hds43l` (the peek bug) in the Part 1 commit; `done` the audit item in the final commit. If Tenzing fails, note it and continue.

## Denied or failing commands — named alternatives
- `tenzing` unavailable: skip, list the intended commands in the report.
- `npx playwright install` needed: run it once; if denied, run only the projects whose browsers exist and report the gap.
- Any network call blocked: skip that step, report it. Never use `git push`, `vercel`, or deploy commands.
- A long test run timing out: rerun only the failing file with `--retries=0 --reporter=line`, record both outputs.

## Tiers and wall time
- Walker: roughly 4 viewports × 2 projects × ~30 checkpoints; expect 5–10 min per full walk. Use `--workers=4`.
- Full `npm run test:all` once at the very end only.

## Done means
- Zero walker findings across all viewports/themes, or a short "Needs Ashish" list with evidence.
- Report: start/end SHA; baseline findings count by check (A–H); every fix (file, cause, one line); every exemption added and why; "Visible changes" list; "Needs Ashish" list; loops run; full-suite counts; the final `docs/AUDIT_FINDINGS.md` committed (showing zero or the remaining items).
- UNVERIFIED: real iPhone. Ashish's manual pass covers only judgment-level things afterwards.

## Pre-answered
- A check is noisy on a legitimate design (e.g. the board)? Exempt with a code comment naming the element and reason; report it.
- Contrast fails on an approved colour pair? Report under "Needs Ashish"; don't change the colour.
- A fix touches many files? Fine, if it's the same mechanical cause.
- Landscape findings that conflict with portrait fixes? Fix both via responsive classes; never break the approved portrait layout.
- Out of time or loop budget? Commit what's done, clean tree, report remaining items.
