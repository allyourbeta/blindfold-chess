# SPEC_menu_endgame_lab.md — "Endgame Lab" above setup, two-line tagline

Written 2026-10-22 14:55 PT by Claude (planner). Executor: Claude Code. One phase, one commit.
Visual target: `docs/targets/menu-endgame-lab.html` (approved by Ashish). Match it.
Runs after SPEC_theme_toggle_tap.md. If that round is not committed yet, stop and say so.

## What Ashish will SEE change (nothing else may change)
1. The menu button "Practice an endgame" reads "Endgame Lab".
2. It moves above "Set up a position".
3. The tagline breaks into two lines: "The ultimate test" / "of cerebral fitness". Same size, weight, spacing and capitals as today.
4. UNCHANGED: the endgame screen's own title, the setup button text, everything else on the menu.

## Environment facts checked (source zip 2026-10-22 14:09)
- `src/components/screens/MenuScreen.tsx:110-113`: tagline `<p className="relative mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">The ultimate test of cerebral fitness</p>`.
- `MenuScreen.tsx:155-161`: "Set up a position" Button then "Practice an endgame" Button, both `className="mt-3 w-full" variant="secondary" disabled={!engineReady}`.
- Tests that click `/Practice an endgame/i`: `endgames-scroll`, `endgames-results`, `offline`, `button-fit`, `endgames-remove`, `endgames`, `endgames-tap-targets`, `engine-lifecycle`, `endgames-favorites` (all in `tests/e2e/`).
- `CLAUDE.md` says `PHONE_USABLE` lives in `tests/e2e/play-layout.spec.ts`; round 86 moved it to `tests/e2e/helpers.ts`. Stale line.
- `public/sw.js:3` `CACHE_NAME`: bump by one from whatever the theme-toggle round left (expected `v61` → `v62`).

## Implementation (decided)
- Swap the two Buttons' order; change the label to "Endgame Lab". Keep classes and handlers.
- Tagline: two `<span className="block">` lines inside the same `<p>`. No `<br>`, no class changes on the `<p>`.
- Replace `/Practice an endgame/i` with `/Endgame Lab/i` in all nine test files. A shared helper is fine if it already exists in `helpers.ts`; do not create one just for this.
- `CLAUDE.md`: correct the `PHONE_USABLE` line to point at `tests/e2e/helpers.ts`.

## Tests (write first, red on old code — checklist rule 5)
`tests/e2e/menu-screen.spec.ts`, iphone project at `PHONE_USABLE`:
1. Button "Endgame Lab" exists, and its top is above the top of "Set up a position".
2. The tagline renders as exactly two lines: "The ultimate test" and "of cerebral fitness" (compare the two spans' text, and assert their tops differ). Case-insensitive, since it's displayed uppercase.

## Housekeeping
- Bump `CACHE_NAME` as above.
- `tenzing backlog add blindfold-chess "Endgame Lab label and order, two-line tagline"` at start, `done` in the commit. If Tenzing fails, note it and continue.

## Tiers
- `menu-screen.spec.ts` red then green, then the nine renamed specs once: about 2 minutes.
- Full `npm run test:all` once at the end.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start/end SHA, red/green, full-suite counts, a menu screenshot at `PHONE_USABLE` compared to the target.

## Pre-answered
- Rename the endgame screen title too? No.
- Change the tagline wording? No.
- A failure this change can't touch? Report it with output. Never call it stale.
