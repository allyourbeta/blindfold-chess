# SPEC: Phase 2 — Maia as the opponent

## Context

Stockfish at low depth plays like a strong engine with a lobotomy: sound
positional moves punctuated by inhuman blunders. Maia is a neural network
trained on human games at specific rating bands, so it plays like a player
of that strength — including making the mistakes such a player makes. For
blindfold training against a "person", that is the whole point.

This spec supersedes any earlier `SPEC_phase2_maia.md`. The engine layer was
rewritten after that draft (abort/generation semantics, an error path, an
init timeout), and a Maia adapter must satisfy the CURRENT contract in
`src/engine/types.ts` and `src/engine/engineManager.ts`. Read both before
writing anything, plus `src/engine/stockfishAdapter.ts` as the reference
implementation.

## Preconditions (STOP if not met)

- Clean tree, `main` up to date with origin. If dirty, STOP and report.
- `npm run test:all` passes before you start. If not, STOP and report.
- Work on a branch: `git checkout -b maia`. Commit there. Do NOT push, do
  NOT merge to main — Ashish reviews and merges.

## Decided design

- **Maia-1** for this prototype (weights are GPL-3.0 — see Licensing).
  Maia-2 (MIT) is the likely production choice; keep the adapter's model
  loading generic enough that swapping weights is a config change, not a
  rewrite.
- **Nine rating bands, 1100–1900 in 100-point steps.** Default 1500.
- **Maia becomes the opponent. Stockfish stays for hints**, unchanged —
  hints should remain best-move advice, not human-like advice. Both engines
  therefore coexist at runtime.
- Models are static assets under `public/models/`, ~3.5 MB each, ~31 MB
  total. They are NOT bundled into the JS.

## Part 1 — the adapter

New: `src/engine/maiaAdapter.ts`, implementing `EngineAdapter` exactly:

```ts
readonly id: string;
init(): Promise<void>;
isReady(): boolean;
setLevel(level: EngineLevel): void;
requestMove(fen: string, moveHistory: string[]): Promise<string>;
stop(): void;
dispose(): void;
```

Contract details that matter and are easy to get wrong:

- `requestMove` resolves a **UCI move string** (e.g. `e2e4`, `e7e8q`), same
  as Stockfish's. `engineManager` maps to SAN; don't duplicate that.
- `moveHistory` exists for you: Maia's input planes include recent history.
  Stockfish ignored it; you must not.
- `init()` needs a **timeout** that rejects, disposes, and leaves the manager
  in `failed` so the existing retry UI appears — mirror
  `stockfishAdapter.ts`'s pattern. Model download over a phone connection is
  slower than a WASM boot: pick a timeout that reflects ~31 MB on mobile
  data, and justify the number in a comment.
- A failed or impossible request must **reject**, not resolve with a
  sentinel. `engineManager` turns rejection into its `onError` path; a
  silent return would reproduce the exact bug round 40 fixed.
- `stop()` must make an in-flight inference abandonable. `abortSearch()` in
  the manager bumps a generation so late replies are dropped, but the worker
  should also stop wasting CPU on a game that has ended.
- Run inference in a **Worker**, not on the main thread. A forward pass
  blocking the UI thread would freeze the keypad.

Use `onnxruntime-web`. Add it as a dependency — this is the one new
technology this round introduces, and it was approved specifically.

## Part 2 — move selection

1. Run the position through the network for a policy distribution.
2. **Mask to legal moves** from chess.js, then **renormalise**. Never trust
   the raw distribution to contain only legal moves.
3. **Sample** from the masked distribution at temperature 1.0 — do not take
   the argmax. Argmax makes Maia deterministic and repetitive; sampling is
   what produces human variety. Make temperature a named constant with a
   comment, since it's the obvious future tuning knob.
4. If sampling somehow yields nothing (empty legal list shouldn't reach you —
   `beginGame` now detects game-over first), reject.

Keep this logic in a pure, testable function separate from the worker
plumbing — `src/engine/maiaPolicy.ts` or similar. The masking and
renormalisation must be unit-testable without loading a model.

## Part 3 — strength selection

`SKILL_LEVELS` in `src/state/settingsStore.ts` is currently eight Stockfish
depth/skill entries (`Beginner (~800)` … `Full Strength`). Maia's ladder is
nine model files, 1100–1900. These do not map onto each other.

Decide and implement one coherent scheme, and explain your choice in the
report:

- The setting the player sees should read naturally (a rating, as now).
- `EngineLevel` currently carries `{ label, depth, skill }` — Stockfish's
  parameters. Maia needs a model identifier instead. Extend the type
  cleanly rather than overloading `skill` with a rating.
- **Persisted `skillIndex` values must migrate**, not silently mean
  something different after this round. Someone on "Club (~1500)" should
  land on Maia 1500, not on whatever index 2 happens to be. Test the
  migration.
- Hints still run Stockfish, so the Stockfish level must remain derivable.

## Part 4 — offline and caching

Offline play after one online load is a hard requirement and there is an
existing e2e test for it.

- The service worker must runtime-cache `/models/` requests. Follow the
  existing strategy in `public/sw.js`; note the file's own comment about
  cache naming before you touch it.
- 31 MB is too much to precache on first load. Cache the model that's
  actually used, on use.
- Decide what happens when the player picks a band whose model isn't cached
  and they're offline: surface it through the manager's error path with a
  clear message (never a silent hang). State your choice in the report.

## Part 5 — tests

Unit:

- Legal-move masking: illegal moves get zero weight; the remainder sums
  to 1.
- Sampling respects the distribution (seed or inject the RNG — don't write a
  flaky statistical test).
- Promotion moves survive the UCI round-trip (`e7e8q`).
- Skill migration: each old persisted index lands on the intended band.
- Adapter init timeout leaves status `failed`.

Sanity gates against the real `maia-1500` model — these are the tests that
prove it actually works, not just that it runs:

- From the start position, the sampled move is legal.
- Over ~20 samples from the start position, moves concentrate on plausible
  human openings (e4/d4/Nf3/c4 dominating) rather than spreading uniformly.
- A position with one obvious recapture recaptures most of the time.
- Two runs from the same position with different RNG give different moves at
  least sometimes (proves sampling, not argmax).

Mark model-loading tests clearly and keep them out of the fast unit path if
they're slow.

E2e: the existing suite must pass unchanged, including
`engine-lifecycle.spec.ts` and `offline.spec.ts`. Those tests are now the
contract for "the app never strands the player" — Maia must satisfy them as
Stockfish does. Add one e2e proving a full game against Maia.

## Licensing (do not skip)

Maia-1 weights are **GPL-3.0**. Shipping them in a deployed web app has
implications Ashish needs to see stated plainly. Add a `MODELS.md` (or a
section in README) recording: which weights, their licence, their source
URL, and the sha256 of each file. Do not silently vendor GPL assets with no
attribution. If you conclude Maia-2 (MIT) is the better choice for this
reason, say so in the report — but implement Maia-1 as specced; the
weights-vs-licence decision is Ashish's, not yours.

## Finish

- Bump `CACHE_NAME` in `public/sw.js`.
- `npx tsc -b`, `npx vitest run`, `npm run build`, `npm run test:all` green.
- No file over 300 lines.
- Commit on the `maia` branch. Do NOT push, do NOT merge.
- Report: files added/changed, test counts before/after, the strength-ladder
  scheme you chose and why, the offline-missing-model behaviour you chose,
  measured model load time and inference time on a cold start, every
  judgment call, and anything deferred.
