# SPEC: Three tests for the things you can't see

## Why these three and nothing else

This project's real bugs were found by playing, not by testing — the static,
the auto-completed moves, the illegal-move substitution. That's fine: a
person at a keyboard is the right instrument for anything visible.

So don't add tests for what a player would notice. Add them only where a
failure would be **silent**: wrong but plausible, or broken only for someone
else, or broken only later.

Three gaps qualify. Nothing else in this round.

## Rules

- **Tests only.** No behaviour changes. You may export an existing constant
  or extract a pure helper if a test genuinely can't reach it otherwise —
  but nothing that alters what the app does. If a test can't be written
  without restructuring, write down why and skip it.
- **Every test states its falsifier** in a comment: one sentence naming what
  would make it go red. If you can't write that sentence, the test isn't
  testing anything — the suite already carried three tests like that and
  they all passed while the app was wrong.
- Deterministic. Seed any generator. A test that fails once in twenty runs
  will be ignored within a week.
- Keep the unit suite fast. If the property test below pushes it past a few
  seconds, reduce the sample count rather than the strictness.
- Branch `tests-hardening`, commit per test, no push, no merge.

## Test 1 — move integrity, as a property

The suite currently asserts examples: `Nc4` is rejected, `e5` doesn't become
`Be5`. Those came from bugs we happened to hit. The underlying property is
stronger and covers the ones we haven't hit:

> For any position, a completed keypad entry either plays a legal move whose
> piece **and** destination are exactly what was stated, or is rejected.
> Never a different piece. Never a different square.

Generate positions deterministically — a seeded random walk from the start
position gives variety cheaply, and include a handful of fixed awkward FENs:
promotions available, en passant available, both castles available, a
position with two knights able to reach one square, and the audit's
bishop-collides-with-pawn-destination case.

For each position, enumerate every completed entry the keypad can produce —
each piece key (including pawn) crossed with every file and rank, plus both
castles — and assert:

- if `computeEntryState` resolves, the resolved SAN is in `chess.moves()`
  **and** its piece and destination square match what was stated;
- if it doesn't resolve, it is marked `invalid` or is still narrowing
  (a disambiguation chooser), never silently nothing;
- an `invalid` entry submitted through the store's keypad path leaves the
  position unchanged.

That last one is the important half: check the store, not only the pure
function. The bug that shipped lived between them.

## Test 2 — the model survives a deployment

The model is cached in a cache separate from the app shell, so that a new
version doesn't wipe it. Nothing verifies that, and if it regressed you would
never see it: your phone already has the model. Someone else's would silently
re-download 3.3 MB, or fail offline.

E2e. Load the app so the model is fetched and cached. Then simulate a
deployment by deleting every app-shell cache from the page — matching what
the service worker's `activate` handler does on a `CACHE_NAME` bump, so the
test tracks the real cleanup rule rather than a guess. Assert:

- the model's cache entry still exists afterwards;
- the app still plays a move offline after that simulated upgrade.

If simulating the upgrade faithfully proves impractical in Playwright, say
so plainly and assert the weaker but still useful invariant: the model lives
in a cache whose name is not the app-shell cache name, and the app-shell
cleanup rule cannot match it. State in the comment which of the two you
implemented.

## Test 3 — the clip inventory is consistent

Three lists must agree and are maintained by hand in three places: the clip
ids the code can emit, the `.wav` files on disk, and `sw.js`'s precache
array. The last cleanup round came one careless step from precaching three
URLs that no longer exist.

A unit test using `fs`:

- every id in `CLIP_IDS` has a file in `public/audio/`;
- every `.wav` in `public/audio/` is in `CLIP_IDS` — this is the direction
  that catches orphans, which is how three dead clips survived the removal
  of voice input;
- the clip list in `public/sw.js` matches `CLIP_IDS` exactly. Parse the
  array out of the file text; it's a hand-maintained duplicate and that's
  precisely why it needs pinning.

Note in a comment that this test cannot tell whether a clip *sounds* right —
the "eff" bug was a correct file that no test could have caught — so its
falsifier is about inventory only.

## Finish

- `npx tsc -b`, `npx vitest run`, `npm run build`, `npm run test:all` green.
- Commit per test on `tests-hardening`. Do NOT push.
- Report: the three falsifier sentences verbatim, the sample count you chose
  for Test 1 and the suite's runtime before and after, which variant of Test
  2 you implemented and why, and — most usefully — whether any of the three
  found a real problem while you were writing it.
