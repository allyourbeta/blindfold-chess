# SPEC — Endgames: drop every position that starts mid-trade

Version 2. Written 2026-10-07 11:55 PT. Replaces version 1 (which repaired positions; Ashish chose to drop them instead).
No visible screen changes. Ends at commit. Do not push.

## The problem

Some shipped positions let the side to move grab material for free. Most are game positions caught mid-trade.
Decision (Ashish): delete them. No editing. No replacements.

## What was checked before writing this

Source: `blindfold-chess_source_2026-10-07_111025.zip`, SHA ec07e68 per the last report.

- `src/data/endgames.json`: 310 entries. Manifest `scripts/endgames/sources.json`: 310 records.
- A one-step free-capture check found 30 bad entries. Examples:
  - `12-to-16-pieces-mixed-30` `1r5Q/2kb1p2/4P3/3pP3/pp1N4/8/PPPR4/1K6 b`: rook takes a free queen.
  - `12-to-16-pieces-mixed-37` `r2r2k1/1b3ppp/4p3/8/1R2P3/3Q4/5PPP/1R4K1 b`: free queen.
  - `12-to-16-pieces-mixed-3` `2q2bk1/p4r1p/1p4pB/8/8/1Q5P/3r1PP1/3R3K w`: free rook.
- After dropping those 30, per bucket (total, Black share): 3–5: 66, 42%. 6–8: 82, 51%. 9–11: 70, 47%. 12–16: 62, 48%. Total 280. All Part 1e rules of SPEC_endgames_catalog.md still hold at these numbers.
- Pipeline: `scripts/endgames/build.mjs`, `buildPool.mjs`, `selectCatalog.mjs`, `curate.mjs`, `verify.mjs`, `mirror.mjs`. Tests: `src/services/endgames/catalogShipped.test.ts`. Scripts `endgames:build`, `endgames:verify` (`package.json:16–17`).
- SPEC_CHECKLIST.md: checked. Notes at the end.

## Decisions you will see

None on screen. The list shrinks to about 280 positions.

## Decisions made for you

- QUIET means the side to move has no capture with a static exchange evaluation (SEE) of +2 or more. Real SEE: swap list, least valuable attacker first, P1 N3 B3 R5 Q9, king last.
- The exact drop count may differ slightly from 30, because SEE is more accurate than the audit's check. Use the SEE result.

## Part 0 — Start (tier: none, ~1 min)

`git status` clean. Branch `main`. `git merge-base --is-ancestor ec07e68 HEAD` succeeds. Record HEAD.

## Part 1 — Quiet check (tier: unit, ~10 min)

1. `src/services/endgames/quiet.ts`: `see(fen, move)` and `isQuiet(fen)`. Keep a script copy in step the same way `mirror.ts` / `mirror.mjs` are today.
2. `quiet.test.ts`: the three example FENs are NOT quiet. The starting position IS quiet. A queen able to take a defended pawn IS quiet.
3. `catalogShipped.test.ts`: every shipped entry is quiet.
4. Red before green: run the shipped test on the CURRENT catalog. It must fail. Report the exact count.

## Part 2 — Drop them (tier: live data, ~5 min)

Live reason (rule 10): this rewrites the catalog.

1. Delete every non-quiet record from `scripts/endgames/sources.json`. Delete nothing else.
2. `build.mjs`: refuse (exit 1) if any built entry is not quiet. `buildPool.mjs` / `selectCatalog.mjs`: skip non-quiet candidates. This stops a re-run from bringing them back.
3. `npm run endgames:build` then `npm run endgames:verify`. Exit 0.
4. Part 1e catalog rules must still pass. If a bucket or total falls below its minimum, lower that minimum in the test to the new actual count and say so. Do NOT add positions. No other rule changes.
5. "Position N" names renumber by themselves. That is expected.

## Part 3 — Finish (tier: full suite once, ~3 min)

1. `npm run test:all` once.
2. `git add -A && git commit -m "Endgames: drop positions that start mid-trade"`.
3. Do NOT push.

## Report

Starting and ending SHA. How many dropped. New bucket table: total and Black share. Any minimum lowered. PROVEN with the red-before-green. UNVERIFIED. Never "done".

## Checklist notes

1. No parked questions; the minimum rule is pre-answered.
2. Counts and examples computed from the shipped file.
3. Shipped test reads the real catalog.
4. Tiers and times stated.
5. Red is the current catalog failing.
6. All of it is worth the run.
7. No visible decisions.
9. Checked: memory, this conversation, the repo zip.
10. One live step, reason given.
12. Done, not measured.
13. Counterpart: build and pool filters block re-entry.
