# SPEC: Maia becomes the opponent

## Context

The spike (`SPEC_maia_spike.md`, branch merged) proved this works: the model
loads on an iPhone, inference is fast, and its output matches an independent
Python reference exactly. `src/maia-spike/` holds working, validated encoding
and inference code. `MODELS.md` and `CREDITS.md` hold the artifact manifest
and provenance. Read all of them, plus `src/engine/types.ts`,
`engineManager.ts`, `stockfishAdapter.ts` and `gameFlow.ts`, before starting.

This round makes Maia the opponent in the actual game.

## Preconditions (STOP if not met)

- Clean tree on `main`, `npm run test:all` green. If not, STOP and report.
- Branch `maia-integrate`. Commit there. Do NOT push, do NOT merge.

## Decided design — do not deviate

**One model.** `maia_kdd_1900` only. No rating ladder, no band switching, no
model selection UI. `maia_kdd_1800` stays on disk for the spike page but the
game never loads it.

**Sampling, always.** Maia is deterministic if you take its top move, and a
deterministic opponent is explicitly unwanted. Every move is drawn from the
masked, renormalised policy distribution — every move of the game, not just
the opening.

**A randomness slider is the headline feature of this round.** It is the
player's main control and it replaces the old strength ladder. Five stops,
worded not numbered:

| Stop | Behaviour |
|---|---|
| Predictable | always the top move (deterministic — offered for completeness) |
| Focused | sharpened: strong preferences dominate |
| Human | faithful to the model's own probabilities — DEFAULT |
| Loose | flattened: unlikely moves appear more often |
| Wild | strongly flattened: expect the occasional bad move |

Implement as a temperature applied to the distribution before sampling.
Choose the actual constants, state them in the report with your reasoning,
and make them one named table that is trivial to retune — Ashish will adjust
these by feel after playing. "Human" must be exactly faithful (no
transformation), and "Predictable" must be a true argmax, not a very low
temperature.

Persist the setting like `showTicker`/`assistMode` in `localStore.ts`,
default "Human".

**Stockfish stays in the codebase.** It is no longer the opponent, but do
NOT delete `stockfishAdapter.ts`, its tests, or the manager wiring that
supports it — there may be a future case for deterministic analysis. It
simply isn't constructed for play. Keep its unit tests passing.

**Hints are unchanged.** `requestHint` calls `formatHint(chess)` and lists
legal moves; it never used Stockfish. Leave it alone.

## Part 1 — promote the spike code

`src/maia-spike/encoding/` and the worker are validated; move (don't rewrite)
what the game needs into a permanent home, e.g. `src/engine/maia/`. Keep the
GPL isolation the spike established: the ported code stays behind the worker
boundary, never imported by the app's own modules, and `CREDITS.md` stays
accurate about where it lives.

The spike page keeps working. If that means some duplication, prefer
duplication over breaking it — it stays useful as a diagnostic.

## Part 2 — the adapter

`MaiaAdapter implements EngineAdapter` — the real one in
`src/engine/types.ts`, not an approximation:

- `init()` loads ONNX Runtime and the single model. Timeout sized for a
  3.5 MB download on mobile data, justified in a comment. On timeout:
  reject, dispose, leave the manager `failed` so the existing retry UI shows.
- `requestMove(fen, moveHistory)` resolves a UCI string. On any failure it
  must **reject** — `engineManager` converts that into its `onError` path.
  A silent return would reproduce the bug round 40 fixed.
- `setLevel` carries the randomness stop, not a depth/skill pair. Extend
  `EngineLevel` cleanly rather than overloading existing fields.
- `stop()` abandons in-flight inference. `dispose()` releases the session.
- One session, created once, reused.
- Pin `executionProviders: ["wasm"]` and `numThreads = 1`. Self-host the ORT
  assets; no CDN.

Sampling and masking live in a pure, testable module with no ONNX or DOM
imports, so the distribution logic can be unit-tested without a model.

## Part 3 — history planes (the known weak point)

The spike's `boardToInputPlanes` implements lc0's `fen_only` rule, read from
lc0's C++ source rather than ported from a tested reference. It is the least
verified thing in the pipeline.

The app now has real move history for standard games, which the spike never
used. Decide and implement:

- Standard games: feed the real history if that's what lc0 would do, or keep
  `fen_only` uniformly. Say which and why.
- Custom-FEN games: `moveHistory` is empty; `fen_only` is the only option.

Before this ships, **verify the rule** on a handful of non-startpos positions
against a trusted reference (real lc0, or the Python reference the spike
already used). If you cannot verify it, say so plainly in the report rather
than assuming it's right.

## Part 4 — settings, status, service worker

- Settings: remove the eight-entry Stockfish ladder from the player-facing
  UI, add the randomness control. The opponent is labelled **"Maia 1900"** —
  the model's name, not a strength promise.
- `StatusLine` currently shows the old difficulty label; update it to the new
  opponent + randomness wording, and **grep the e2e suite for every string
  you change** — that has bitten this project before.
- Service worker: the model must survive deployments. Today `activate`
  deletes every cache whose name isn't `CACHE_NAME`, so bumping the version
  would wipe a downloaded model. Give models a **separate, durable cache**
  that app-shell upgrades don't touch, keyed so it only invalidates when the
  model itself changes. Verify the model's sha256 against `MODELS.md` before
  first use; on mismatch, evict and refetch rather than running a corrupt
  model.
- Offline: after one successful online game, offline play must work. If the
  model isn't cached and the device is offline, surface it through the error
  path with a clear message — never a silent hang.

## Part 5 — tests

Unit:
- Masking: illegal moves get zero weight; the rest sums to 1.
- Each slider stop behaves as specified — Predictable is argmax; Human is
  untransformed; Wild demonstrably flattens. Inject the RNG; no flaky
  statistical tests.
- Promotion moves survive the UCI round-trip.
- Adapter init timeout leaves status `failed`.
- Randomness setting persists and defaults to Human.

E2e — update the existing suite's engine-specific strings rather than
preserving them literally; `engine-lifecycle.spec.ts` hard-codes
"Stockfish thinking…", `/engine/stockfish.js` and "Full Strength". Preserve
each test's **intent**: the app must never strand the player. Add:
- a full game against Maia (deterministic: set Predictable so the test is
  reproducible);
- model fetch failure → error surfaced, retry available;
- offline play with a previously cached model.

## Finish

- Bump `CACHE_NAME` (and confirm the model cache survives it).
- `npx tsc -b`, `npx vitest run`, `npm run build`, `npm run test:all` green.
- No file over 300 lines.
- Commit on `maia-integrate`. Do NOT push.
- Report: files moved/added/changed, the temperature constants you chose and
  why, what you did about history planes and whether you verified it, test
  counts before/after, every judgment call, and anything deferred.
