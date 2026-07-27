# SPEC: Maia spike — prove it before building it

## Why this is a spike and not the feature

An external review of the full Phase 2 spec found several holes worth
respecting. The important one: a wrong board-to-tensor encoding or a wrong
policy-index mapping produces moves that are perfectly legal and completely
wrong, and no ordinary test catches it. The app would look like it worked.

So this round builds nothing into the game. It answers four questions:

1. Do the ONNX models load and run in a worker on an actual iPhone?
2. Is our encoding and decoding correct?
3. How fast is a move, cold and warm?
4. How much memory does it cost?

If the answers are good, the integration spec follows and is mostly
plumbing. If they're bad, we found out for the cost of one page.

## Scope — deliberately isolated

- Branch `maia-spike`. Clean tree precondition. Commit only; do NOT push,
  do NOT merge.
- A standalone page (e.g. `/maia-spike.html` plus its own entry point) that
  is NOT wired into the app. It's a lab bench Ashish can open on his phone.
- **Do not touch** `engineManager`, `stockfishAdapter`, `gameFlow`,
  `settingsStore`, the service worker, or any existing test. If you find
  yourself editing game code, stop and report instead.
- Add `onnxruntime-web` as a dependency. That is the only new dependency.

## Models

Use **maia_kdd_1900** as the primary and **maia_kdd_1800** as the second.
Not 1500. (Maia plays somewhat above its training band, and Ashish is a
strong player; the useful range for him is the top of the ladder.)

CSSLab's own web platform runs these models client-side —
`CSSLab/maia-platform-frontend`, `src/contexts/MaiaEngineContext/`. Read it
first. Do not convert lc0 `.pb.gz` weights yourself.

Record in `MODELS.md`, for each file: source URL, sha256, byte size, ONNX
opset, exact input names/shapes/dtypes, exact output names/shapes, and
whether the policy output is **logits or probabilities** — state how you
determined that, don't assume. This manifest is the deliverable that makes
the integration round safe.

## ONNX Runtime configuration — be explicit

iOS Safari supports the WASM backend; WebGPU is unavailable and WebGL is
in maintenance. The app has no COOP/COEP headers, so WASM threads are not
available.

```js
executionProviders: ["wasm"]
ort.env.wasm.numThreads = 1
```

Self-host the ORT runtime assets (`.wasm`/`.mjs`) rather than using a CDN —
offline is a requirement of the eventual feature, and mixing runtime files
from different package builds is unsafe. Run inference in a worker.

Create the session once and reuse it. Hold at most one session at a time.

## Encoding and decoding — COPY, do not derive

Every app using Maia solves this same problem, and CSSLab already solved it
in public under a permissive licence. **Port their code. Do not write your
own.**

`CSSLab/maia-platform-frontend` is MIT licensed, so its encoder and its
policy-index mapping can be lifted directly, not merely consulted. Take
them as close to verbatim as the port allows: keep their function names,
their constant tables, their ordering, and their comments. A future
divergence between our copy and their upstream should be readable as a
diff.

The only permitted changes are mechanical: adapting imports, module format,
and whatever is needed to run inside our worker rather than their React
context. Anything beyond that is a divergence — list every one in the
report with a reason.

If you find yourself reasoning about plane order, board orientation, or
which index means which move, STOP. That reasoning has already been done
correctly by someone else, and redoing it is exactly how this goes wrong.

Record in CREDITS.md what was ported and from which commit.

## Verification gates — confirming the port, not deriving it

These exist for one narrow reason: a hand-port can drop a line, and a
dropped line here produces moves that are legal, plausible and wrong. They
check that the copy landed intact. They are not a substitute for copying,
and they should be quick.

**1. Policy-map round-trip.** For a set of positions, every legal move
chess.js reports maps to exactly one policy index, and decoding that index
returns the same move. No collisions, no gaps.

**2. Colour-mirror symmetry.** Take a position, mirror it (flip ranks, swap
colours, adjust castling rights and side to move). The move distribution
from the mirrored position must be the mirror of the original's, within a
small tolerance. This is the strongest self-check available without running
lc0: a wrong plane order or a wrong black-to-move transform will fail it,
and almost nothing else catches those.

**3. Obvious-move sanity.** A handful of fixed positions with one clearly
correct move — a mate in one, a free queen, a forced recapture. The right
move should be in the top few by policy weight. Report the actual weights
rather than asserting a threshold you guessed.

**4. Nonsense detection.** From the start position, report the top ten moves
with weights. A correct 1900 model gives a recognisable opening
distribution. Garbage here means the encoding is wrong even if gates 1–3
somehow passed.

Gates 1 and 2 are automated tests. Gates 3 and 4 print results to the page
for a human to judge — the point is Ashish looking at them.

## Measurements — report actual numbers

On the page, timed and displayed:

- cold model download time
- session creation time
- first inference
- median inference over ~20 moves
- `performance.memory` or `navigator.storage.estimate()` where available

Ashish will run this on his iPhone. Numbers from your machine are not the
answer, but include them for comparison.

## Deliberately out of scope

Not this round, and don't half-build them: the strength ladder and
settings, service-worker model caching, offline behaviour, replacing the
opponent, hint changes, promotion of the spike page into the app.

Note for the integration spec that these were found to be wrong or missing
in the earlier draft, so they need decisions rather than assumptions:

- Hints do **not** currently use Stockfish — `requestHint` calls
  `formatHint(chess)`, which lists legal moves. Replacing the adapter would
  remove Stockfish from the app entirely.
- `skillIndex` is **not persisted** anywhere, so there is no migration to
  write — but there is a product decision about what happens to the labels
  above 1900 (Master, Full Strength).
- The service worker deletes every non-current cache on activation, so
  models would be wiped by any deployment.
- `moveHistory` is empty for games started from a custom FEN, so history
  planes can't be reconstructed there.

## Finish

- `npx tsc -b`, `npm run build` green. Existing tests untouched and still
  passing.
- Commit on `maia-spike`. Do NOT push.
- Report: the model manifest, which encoding parts you mirrored, gate
  results with actual numbers, your measurements, and — most important —
  anything that makes you doubt the encoding is right.
