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

**Tenzing backlog.** File findings as you go, not batched into a report: `tenzing backlog add bc "<title>"`. Close what you finish in the same commit as the work that finished it: `tenzing backlog done <ref>`. If either command fails for any reason (network, lock, whatever), that is not a reason to stop the task -- note it and continue; do not block the actual work on Tenzing's own plumbing.

## Endgame catalog

Each position has a permanent `code` (E###). To delete one, remove it from
`scripts/endgames/sources.json` and add its code to `retired` in
`scripts/endgames/codes.json`. New positions take `next`. Never renumber.

**Test economy.** Run only the tests covering what you just changed. Run the full suite once, at the end of the session, not after every phase. Never re-run a passing tier to confirm it still passes. Live-model tests are the slowest and most expensive -- run each one once unless it failed or its input changed.
