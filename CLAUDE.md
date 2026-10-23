# blindfold-chess

## Backlog format (read by Tenzing)

`docs/backlog.yaml` is this project's record of work and is read by Tenzing.

- Items are entries under `items:` with `title`, `status` (`open` or `done`),
  optional `section` and `body`.
- When you ADD an item, omit `id`. Tenzing assigns one within the hour.
- When you EDIT an item, keep its `id` unchanged. Rewording is fine.
- When you COMPLETE an item, set `status: done`. Keep the entry.
- Never remove, reuse or renumber an `id`.
- Do not add priority, estimates or scheduling here. Those live in Tenzing.

**Tenzing backlog.** File findings as you go, not batched into a report: `tenzing backlog add blindfold-chess "<title>"`. Close what you finish in the same commit as the work that finished it: `tenzing backlog done <ref>`. If either command fails for any reason (network, lock, whatever), that is not a reason to stop the task -- note it and continue; do not block the actual work on Tenzing's own plumbing.

## Endgame catalog

Each position has a permanent `code` (E###). To delete one, remove it from
`scripts/endgames/sources.json` and add its code to `retired` in
`scripts/endgames/codes.json`. New positions take `next`. Never renumber.

**Test economy.** Run only the tests covering what you just changed. Run the full suite once, at the end of the session, not after every phase. Never re-run a passing tier to confirm it still passes. Live-model tests are the slowest and most expensive -- run each one once unless it failed or its input changed.

**Phone-layout checks** use `PHONE_USABLE` from `tests/e2e/helpers.ts`, never the raw 390x844 `iphone` project device size -- real iPhones lose ~93px to the status bar and home indicator that the Playwright device preset doesn't model.

**Any UI change must pass `audit-walk.spec.ts` (all viewports/themes).** New screens, dialogs or controls get a checkpoint in it (`tests/e2e/auditWalkSteps.ts` or `tests/e2e/auditWalkLab.ts`) in the same commit.

**Testing is silent.** Test browsers are muted (`--mute-audio` in `playwright.config.ts`, `muteAudio()` in `tests/e2e/helpers.ts`). Never remove either.

**Layout.** Top padding is always status bar + 12px: `pt-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))]` (the four lab screens use `1.5rem` as the first argument instead of `1rem`).

## Adding, deleting and listing endgame positions

```
npm run pos -- add [image.png] [--black]
npm run pos -- add --fen "<placement>" [--black]
npm run pos -- delete E287
npm run pos -- list
npm run pos -- page
```

Chessdirbek must be running for image recognition.

`npm run pos -- page` opens a local "add a position" page on this laptop
(127.0.0.1:5199) -- paste or drop a board image, set the side to move, Flip
if it was read from the wrong side, and Add when the status line says the
position is legal, quiet and not a duplicate. No list, no delete there.

Removing a position from the shipped app happens on a device, not here:
visit `blindfol.de/#creator`, enter the password once to unlock Remove on
that device, then use Remove on the position screen or the end-of-game
panel. It takes effect on that device immediately and everywhere within
about a minute (the removal is its own commit + redeploy). Visiting
`#creator` again on an unlocked device offers to lock it.

Unlock on any device, including the installed app: tap the build line on the menu 5 times.

## Design

Every control uses `.raised` / `.raised-on` / `.raised-danger` (via Button or SegmentedControl). A button that must be flat carries `data-flat`; `raised-controls.spec.ts` enforces it.
