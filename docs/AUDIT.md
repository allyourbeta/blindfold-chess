# Codebase Audit

Scope and method: per `SPEC_audit.md`. Read-only — no code changed. Findings
were traced from real call sites (component → store → service), not from
grep hits alone; where a call path couldn't be fully confirmed, that's said
explicitly. `npx vitest run` (156/156 passing, 16 files) and `npx tsc -b
--noEmit` (clean) were run only to confirm the premise that these findings
survive the existing safety net, not as part of the audit's pass/fail
criteria.

---

## 1. Findings that could cause wrong behaviour

### 1.1 `moveResolve.ts`'s last-resort fuzzy match silently replays a keypad-rejected entry as a *different piece's* move

**What.** `src/services/chess/moveResolve.ts:114-119`, the `destInNoise`
branch inside `fuzzyMatchMove`:

```ts
const destInNoise = p.match(/([a-h][1-8])/);
if (destInNoise) {
  const dest = destInNoise[1];
  const matches = moves.filter((m) => m.to === dest);   // <- no piece filter
  if (matches.length === 1) return matches[0].san;
}
```

**Why it's suspect.** This branch exists to rescue voice-transcription noise
like `"umm e4 please"` (see `moveResolve.test.ts:82-85`) — any legal move
landing on the one destination square mentioned is taken as the intent, with
no piece constraint, because a transcript genuinely might not have carried
piece information cleanly. That assumption is specific to free-form spoken
input.

**Reachability — full call path.**
`MoveKeypad.tsx:81-90` (`pushTap`) → `computeEntryState` (`entry.ts:211-263`)
→ when a destination square is fully stated and matches **zero** legal moves
*for the piece the player selected* (`complete && candidates.length === 0`,
`entry.ts:245-250`), sets `invalid = buildSanFromSlots(slots)`
(`entry.ts:162-166`) → `MoveKeypad.tsx:88` `play(next.invalid)` →
`gameStore.ts:138` (`submitMoveText`'s default case) →
`gameFlow.ts:218` `resolveMoveInput(s.chess, raw)`.

For a pawn-committed entry (first tap is a file, or `P` then a file),
`buildSanFromSlots` returns just `${destFile}${destRank}` — e.g. `"e5"` — a
bare square, indistinguishable in shape from the voice-noise case the
`destInNoise` branch was built for. The keypad has already established, using
its *own* piece-aware filter (`matchesSlots`, `entry.ts:109-119`), that no
pawn can reach that square — that's precisely why it was marked `invalid`
instead of `resolved`. `resolveMoveInput` then reprocesses the same string
with a filter that has forgotten which piece was meant.

This path is reachable specifically in **`assistMode === "strict"`**
(`src/api/localStore.ts:138`), which is the **default** for every fresh
install (`localStore.ts:143`, confirmed by `localStore.test.ts:79-80`).
In `"assisted"` mode, `computeEnabled` (`entry.ts:168-202`) dims keys down to
only legal completions per the committed piece, so `invalid` can't be
reached there — the comment at `entry.ts:246-247` calls this "defensive in
assisted, where dimming should prevent it." Strict mode has no such dimming
by design (`entry.ts:140-160`, "Dimming here reflects what you've tapped,
never what the position allows") — so in the default mode, a fully-stated
but position-illegal pawn entry reaches `resolveMoveInput` verbatim.

**Live reproduction.** I copied the relevant functions verbatim from
`moveResolve.ts` into a standalone script and ran them against the real
`chess.js` dependency (not a mock) with position
`4k3/8/8/8/8/2B5/P7/4K3 w - - 0 1` (white king e1, bishop c3, pawn a2; legal
moves include `Be5` but no pawn move reaches e5):

```
Legal moves in this position: [ 'Bb4','Ba5','Bd4','Be5','Bf6','Bg7','Bh8','Bd2','Bb2','Ba1','a3','a4','Kd2','Ke2','Kf2','Kf1','Kd1' ]
Keypad determined this entry is INVALID (0 pawn candidates) and submits it for REJECTION: e5
resolveMoveInput result: { ok: true, san: 'Be5' }
BUG CONFIRMED: keypad-rejected entry was silently reinterpreted and would be PLAYED as Be5
```

A player who taps pawn → e-file → 5-rank (intending, and expecting to hear
rejected, an illegal pawn push) instead has the bishop silently moved to e5
and hears it announced as a normal move.

**Blast radius.** Severe if it fires: in blindfold play there is no board to
visually catch the substitution, and the move ticker (off by default,
`localStore.ts:112-121`) is the only way to notice after the fact. The one
test that exercises this exact branch, `moveResolve.test.ts:82-85`
("resolves a unique destination square buried in noise"), only checks
`fuzzyMatchMove(chess, "umm e4 please")` against the **starting position**,
where e4 happens to be the pawn's own only legal move to that square — the
one case where this leniency is harmless. No test exercises the
cross-piece-collision case, so the suite is green while the bug ships. This
test is itself a **Category 4** finding: it encodes voice-era intent
("noisy transcript, forgiving match") and would keep passing under the
current, wrong keypad behaviour.

**Recommendation:** investigate further / fix in its own small round, not
here. High confidence this is live, reachable in the default settings state,
and produces wrong behaviour — verified with the actual dependency, not
inferred from reading alone. The fix is narrow (make the leniency path
piece-aware, or remove fuzzy matching for the `invalid`-marked path
entirely) but changes core move-legality logic and deserves its own tests
per the project's stated aversion to large unattended changes.

### 1.2 The rest of `moveResolve.ts`'s leniency stack is exercised *only* by keypad-synthesized rejection text, and most of it can never match anything

**What.** `resolveDescriptiveMove` (`moveResolve.ts:22-30`) and its
`DESCRIPTIVE_RE` branch in `resolveMoveInput` (`moveResolve.ts:143-150`);
`resolvePartialMove`'s `captureNoRank`/`pieceFile` branches
(`moveResolve.ts:43-58`); `fuzzyMatchMove`'s UCI, `startMatches`, `pdMatch`,
`pcMatch`, and `pawnCap` branches (`moveResolve.ts:72-113`).

**Why it's suspect.** All of these interpret shapes that only free-form
spoken/typed text could produce (`"pxp"`, `"exd"` missing a rank, raw UCI
`"e2e4"`, etc.).

**Reachability.** `resolveMoveInput` has exactly one caller
(`gameFlow.ts:218`), which has exactly one caller in turn
(`gameStore.ts:138`, the default case of `submitMoveText`). `submitMoveText`
has exactly two live callers: `ActionBar.tsx:93,96` (`"fen"`/`"history"` —
both intercepted by `parseTypedCommand` before ever reaching
`resolveMoveInput`) and `MoveKeypad.tsx:77`. The keypad only ever sends (a)
`resolved.san` — an exact, already-legal `chess.js` SAN string, always
caught by the very first `tryChessMove` direct-match check
(`moveResolve.ts:154-155`) — or (b) `invalid`, always exactly
`${pieceLetter}${file}${rank}`, `${file}${rank}`, or a castle string. A
castle `invalid` can't occur: the O-O/O-O-O buttons are disabled whenever
`legalMoves.some(m => m.san === "O-O")` is false (`MoveKeypad.tsx:209,218`
checking `entry.enabled.castleKingside/Queenside`), so a tap can't produce a
castle string the position doesn't allow. No other free-text entry point
exists anywhere in `src/` (confirmed: no `SpeechRecognition` /
`webkitSpeechRecognition` reference remains in the tree).

None of the shapes the keypad can produce can match `DESCRIPTIVE_RE`
(requires an `x` in position 2, e.g. `"pxp"`), the rank-less capture pattern
(`"exd"`), the rank-less piece pattern (`"nf"`), full UCI (4-5 chars), or the
pawn-capture-with-file pattern. I traced this from the two producers'
output shapes, not from a fuzzer — stated confidence below reflects that.

**Blast radius.** None directly (never invoked), but their presence makes
the file read as a single well-exercised move parser when it's mostly inert
scaffolding wrapped around the one live, dangerous branch in §1.1.

**Recommendation:** simplify in the same round as §1.1 — once the
`invalid`-path shape is settled, most of this file's pattern-matching layers
can be deleted outright rather than left inert. Medium-high confidence
(traced by call-graph and input-shape reasoning, not exhaustively tested).

---

## 2. Findings that are merely dead weight

### 2.1 `src/services/audio/sfx.ts` — all three tone functions have zero callers anywhere

**What.** `sfx.ts:10-48` (`playMoveTone`, `playCaptureTone`,
`playErrorTone`), 39 lines of Web Audio oscillator code.

**Why it's suspect.** `SPEC_no_beeps.md` required these be reachable from
exactly one gated call site. That gating was superseded by removing tone
playback outright: `useSpeechOutput.ts:139-141` (inside `drainQueue`) says
so directly — *"The app deliberately generates no confirmation tones."*

**Reachability.** `grep -rn "playMoveTone\|playCaptureTone\|playErrorTone" src`
outside `sfx.ts` itself returns nothing. `SPEC_no_beeps.md`'s own premise —
a three-way `speechMode` (`"silent"`/`"engine"`/`"both"`) where silent mode
keeps its beeps — no longer exists: `SpeechMode` is now `"off" | "on"`
(`localStore.ts:80`), and the legacy migration
(`localStore.ts:83-97`) maps the old `"silent"` value to `"off"`, not to any
surviving beeps mode.

**Blast radius.** None — no test file exists for `sfx.ts`, and nothing
imports it.

**Recommendation:** remove. High confidence.

### 2.2 `rejectionPhraseClips` (phrase.ts) is dead; the shipped rejection path reimplements the same thing independently

**What.** `src/services/speech/phrase.ts:95-105` (`rejectionPhraseClips`).
The live equivalent is a *different* function:
`src/services/speech/utteranceForEvent.ts:12-20` (`rejectionClips`, a local,
unexported function).

**Reachability.** `rejectionPhraseClips`'s only caller anywhere is its own
test, `phrase.test.ts:5,99`. The shipped rejection path
(`utteranceForEvent.ts:48-53`) calls the local `rejectionClips` instead,
which independently regexes the keypad's `attempted` string
(`utteranceForEvent.ts:15`) rather than taking the structured
piece/square/reason arguments `rejectionPhraseClips` expects. The live
function *is* tested, just elsewhere: `utteranceForEvent.test.ts:59-94`
covers piece, pawn, and castle rejections directly, including the exact
`attempted: "e5"` shape from §1.1 — but only at the phrase-formatting layer,
after assuming the upstream classification was already correct, so it
doesn't (and can't) catch §1.1's bug.

**Blast radius.** `phrase.test.ts:95-106` ("covers every clip
`rejectionPhraseClips` and `gameEndPhraseClips` can produce") tests the dead
function and could read as verifying rejection-clip coverage for the app —
it verifies coverage for code nothing calls.

**Recommendation:** delete `rejectionPhraseClips` and its test block; the
real coverage already exists via `utteranceForEvent.test.ts`. Low risk,
high confidence (both functions read in full, both test files read in full).

### 2.3 Three speech clips are unreachable from any live code path: `ambiguous`, `not-understood`, `to`

**What.** `public/audio/ambiguous.wav`, `not-understood.wav`, `to.wav`, and
their token/table entries: `SpokenPart` (`san.ts:41-43,32`),
`SPECIAL_PARTS` (`phrase.ts:20-35`), `CLIP_SPEECH_TEXT`
(`phrase.ts:64-65`).

**Why suspect / reachability.**
- `"ambiguous"` is only ever produced by the dead `rejectionPhraseClips`
  (§2.2) — the live `rejectionClips` never emits it, only ever appending
  `"not-legal"` (`utteranceForEvent.ts:19`). The SAN-level ambiguity path
  that could theoretically want it (`resolveMoveInput`'s
  `resolveDescriptiveMove` rejection, `moveResolve.ts:146-149`) is itself
  unreachable from the keypad (§1.2), and even if it fired,
  `gameFlow.ts:221` sets a generic `spoken: "Illegal move"` /
  `attempted: raw` regardless of the specific rejection reason — there's no
  path left that threads an "ambiguous" reason through to speech at all.
- `"not-understood"` has **zero** producers anywhere in `src/` — confirmed
  by grep; it appears only in its own declarations and its own test
  (`phrase.test.ts:41`). It's a pure leftover from when speech recognition
  could fail to parse an utterance.
- `"to"` is never pushed/returned by any function, live or dead —
  `movePhraseParts` (`san.ts:88-131`) has an explicit comment explaining the
  design choice *not* to use a "to" connector (`san.ts:110-111`, "chess
  players say 'knight f3', not 'knight to f3'"), but the token and its
  audio asset were never pruned from the generation script's output.

**Blast radius.** None to remove — but `preloadClips(ctx, CLIP_IDS)`
(`useSpeechOutput.ts:48`, called from `unlockAudioOutput` on every New Game
gesture) fetches all clips in `CLIP_IDS` including these three, every game
start, for audio that can never play. Small cost (three short `.wav`
files), not a real bandwidth problem, but genuinely dead weight.

**Recommendation:** remove the three clip files and their token/table
entries. High confidence on unreachability; low risk.

### 2.4 `parseTypedCommand` / `commands.ts` — 5 of 7 recognized commands (and all their synonyms) are unreachable through any current caller

**What.** `src/services/chess/commands.ts` (whole file, 28 lines), dispatched
from `gameStore.ts:111-140` (`submitMoveText`).

**Reachability.** `submitMoveText` has exactly two callers today:
`ActionBar.tsx:93` (`submitMoveText("fen")`), `ActionBar.tsx:96`
(`submitMoveText("history")`), and `MoveKeypad.tsx:77`
(`submitMoveText(san)`, always SAN/invalid-entry shaped text, never a
command word — the keypad has no letter keys beyond piece/file/rank/castle).
`ActionBar`'s other five actions — Peek, Hint, Takeback, Resign, and **PGN**
— all call the store's `doPeek`/`requestHint`/`doTakeback`/`doResign`/
`copyPgn` **directly** (`ActionBar.tsx:40,43,49,57,90`), bypassing
`submitMoveText`/`parseTypedCommand` entirely. So of `parseTypedCommand`'s 7
recognized outputs and their synonyms — `peek`, `resign`,
`takeback`/`undo`, `hint`/`moves`/`help`, `fen`, `pgn`, `history`/`stats`
(`commands.ts:6-27`) — only `"fen"` and `"history"` are ever actually
produced by a live caller. `"pgn"` is in the switch and asserted by
`commands.test.ts:14`, but the PGN button calls `copyPgn()` directly
(`ActionBar.tsx:90`), never `submitMoveText("pgn")` — so even that case is
dead in practice.

**Blast radius.** None if removed (unreachable), but it's a second
invocation mechanism sitting alongside five direct calls to the exact same
store methods — duplication left by the migration from a typed-command box
to a button-driven UI (**Category 5**).

**Recommendation:** replace the two live `submitMoveText("fen"/"history")`
calls with direct store calls matching the other five buttons, then delete
`commands.ts` and `commands.test.ts`. Low risk, high confidence.

### 2.5 Stockfish's service-worker precache costs ~1.5 MB per install/version-bump for an engine the app never loads

**What.** `public/sw.js`'s `APP_SHELL` array (includes
`'/engine/stockfish.js'`), fetched by the unconditional `install` handler
(`sw.js:55-60`, `Promise.allSettled(APP_SHELL.map(url => cache.add(url)))`).

**Note:** per `SPEC_audit.md`, Stockfish itself is deliberately retained for
a future analysis feature and is **not** a dead-code finding. This is
narrowly about the SW eagerly paying for it today.

**Reachability of the adapter (confirmed inert):**
`createEngineManager.ts` constructs only `new MaiaAdapter()` — `StockfishAdapter`
is never instantiated anywhere in the reachable app graph
(`App.tsx` → `gameStore.initEngine` → `engineManager.load()` →
`adapter.init()`, always the Maia adapter). `grep` for `StockfishAdapter`,
`ENGINE_URL`, and `new Worker(` outside `stockfishAdapter.ts` and its own
test file finds nothing. The class is inert at the JS level: its `Worker` is
constructed lazily inside `.init()` (`stockfishAdapter.ts:41`), which is
simply never called.

**But the SW is not inert:** `public/engine/stockfish.js` is **1,579,948
bytes (~1.5 MB)** on disk — confirmed with `ls -la` and cross-checked
against the built `dist/engine/stockfish.js` (identical size). It sits in
`sw.js`'s `APP_SHELL` precache list and is downloaded and cached
unconditionally for every visitor on first install and on every
`CACHE_NAME` version bump (currently `v45`) — regardless of whether the app
ever requests it through any other path.

**Blast radius.** None to remove from the precache list — nothing reads
`stockfish.js` back out of the cache today.

**Recommendation:** keep-with-comment for `StockfishAdapter` itself (per
explicit project intent). Separately, dropping `'/engine/stockfish.js'`
from `APP_SHELL` is a one-line, independent fix candidate for whenever
analysis mode isn't imminent — flagged here, not decided here. High
confidence on both the reachability trace and the byte count.

---

## 3. Findings that are only untidy

### 3.1 `src/maia-spike/` is a real, shipping second entry point with a surprising reverse test dependency — not leftover spike code, but fragile

**What.** `src/maia-spike/` (whole tree) vs. `src/engine/maia/` (whole
tree).

Confirmed via a dedicated research pass: `vite.config.ts:38-44` builds
`maia-spike.html` as a second Rollup input, and `dist/maia-spike.html`
actually ships in the build — this is a deliberate standalone diagnostics
page (comment at `vite.config.ts:38-40` says so), not dead weight. The
production app (`App.tsx` and everything under it) has zero references to
`maia-spike`.

The encoder was genuinely **moved**, not duplicated: `src/maia-spike/inference/evaluatePosition.ts:10`
imports `boardToInputPlanes`/`encodeMove` directly from
`@/engine/maia/encoding/lc0Encoder`. `mirrorFen.ts` in the spike tree has no
equivalent in `engine/maia/` — it's spike-only tooling, not a stale copy.
`protocol.ts` and the two `maia.worker.ts` files are deliberately parallel
(each side's comments cross-reference the other, explaining the split:
spike returns a full move distribution + timings for diagnostics, production
returns one sampled UCI move) — real overlap is only ~15-20 lines of shared
ONNX-runtime boilerplate, not worth extracting.

**The surprising part:** `src/engine/maia/encoding/lc0Encoder.test.ts` — a
real production test for the shipped encoder — imports `mirrorFen`,
`mirrorUci`, and `evaluatePosition` **from `@/maia-spike/...`** for its
"gate 2: colour-mirror symmetry" tests. Anyone later deleting
`src/maia-spike/` on the reasonable-looking assumption that it's leftover
spike code would silently break the real engine's test suite.

**Recommendation:** no action on `maia-spike` itself — it's live and
intentional. Worth a comment at the top of `lc0Encoder.test.ts` (or
`maia-spike/`'s own README-equivalent) noting the dependency, so a future
cleanup doesn't delete it assuming it's dead. High confidence.

### 3.2 Root `SPEC_*.md` files: several describe designs the code no longer has

Read all eight non-audit spec files in full against current code:

| File | Status | Note |
|---|---|---|
| `SPEC_phase1_port.md` | shipped, now inaccurate | §7.2-7.3 describes the whole `SpeechRecognition`/`normalize.ts`/`candidates.ts`/`match.ts` stack, all deleted by `SPEC_keypad_input.md`; §3.1's Stockfish skill-ladder also since replaced by Maia. Architecture rules (layering, 300-line cap, localStorage-only-in-api) still accurate. |
| `SPEC_phase2_maia.md` | superseded | Explicitly superseded by `SPEC_maia_integrate.md:11` ("This spec supersedes any earlier `SPEC_phase2_maia.md`"), as `SPEC_audit.md` itself already notes. Also factually wrong against current code (nine rating-band models vs. the one shipped model + randomness slider). |
| `SPEC_maia_spike.md` | shipped, accurate (as spike history) | Describes the spike page, which still exists standalone exactly as described; its deliverables fed `SPEC_maia_integrate.md`. |
| `SPEC_maia_integrate.md` | shipped, accurate | Current authoritative doc for the engine layer — `RANDOMNESS_STOPS`, `MaiaAdapter`, `MODEL_CACHE_NAME` all verified live in code as described. |
| `SPEC_keypad_input.md` | shipped, accurate | All listed deletions confirmed gone; `SpeechMode` collapse to `"off"/"on"` matches `localStore.ts:80` exactly. |
| `SPEC_no_beeps.md` | shipped, now fully obsolete | Its central premise (a `"silent"` speech mode that keeps beeps) no longer exists (§2.1); `utteranceForEvent` — its other deliverable — is still live and accurate. Build-stamp requirement shipped under different names (`__BUILD_TIME__`/`__GIT_COMMIT__`, `MenuScreen.tsx:234`) rather than the spec's literal `__BUILD_ID__`. |
| `SPEC_ios_audio_ui.md` | shipped, partly inaccurate | Mic-button/tap-session sections (Part A4/A5, B1) describe code deleted by the keypad round — no mic button remains. Clip-playback sections (Part A1) still accurate. Part B2/B3 (ActionBar styling, instructions message) not individually re-verified against the later menu redesign commits — **open question**, see §4. |
| `SPEC_engine_lifecycle.md` | shipped, accurate | All five fixes (abort-on-finish, error surfacing, dead-position detection, init timeout, double-record guard) verified present in `gameFlow.ts` and generalized cleanly to the adapter-agnostic engine interface — they now serve Maia too, not just Stockfish. |

**Recommendation:** archive (move to a `docs/specs-archive/` or similar)
`SPEC_phase2_maia.md` and `SPEC_no_beeps.md` outright — both describe
designs since fully replaced. Keep the rest as historical/reference
documents, but a reader should be warned that `SPEC_phase1_port.md`'s
speech sections and `SPEC_ios_audio_ui.md`'s mic sections no longer apply.
High confidence on the deletions/replacements (verified by file absence and
by explicit supersession text); medium on the ActionBar-specific claims in
`SPEC_ios_audio_ui.md` (not individually line-diffed).

---

## 4. Open questions

- **`SPEC_ios_audio_ui.md` Part B2/B3** (ActionBar button styling, dropping
  an instructions message): plausibly superseded again by the later
  menu/ActionBar redesign commits (`c0d205f`, `b5ae194`), but I did not
  line-diff the spec's requirements against the current `ActionBar.tsx`/
  `MenuScreen.tsx` in enough detail to state this as confirmed. Resolve by
  reading that spec's Part B alongside the current files side by side.
- **`SPEC_maia_spike.md`'s four verification gates** — not independently
  re-run; a static read can't confirm whether they'd still pass on today's
  models/weights. Resolve by actually running the spike page's gate
  checks.
- Findings in §1.2 (unreachability of most of `moveResolve.ts`'s pattern
  branches) rest on tracing the two current callers' output shapes by
  reading, not on fuzzing or an exhaustive proof. Confidence is stated as
  medium-high rather than certain for that reason.

---

## Suggested sequence

1. **Independent, low-risk, can go in one small round together:** §2.1
   (`sfx.ts`), §2.2 (`rejectionPhraseClips`), §2.3 (three dead clips), §2.4
   (`commands.ts` indirection → replace with direct calls), §3.2 (archive
   the two obsolete specs). None of these touch move-legality or engine
   logic; each is independently revertable.
2. **Independent, product-level decision, not urgent:** §2.5 (drop
   `stockfish.js` from the SW precache) — gate this on whether analysis
   mode is actually imminent; if it is, leave it precached and note why.
3. **Its own round, with its own tests, highest risk:** §1.1 and §1.2
   together — the `moveResolve.ts` leniency stack. This is exactly the
   class of change the project has been burned by before (types check,
   tests pass, behaviour is still wrong), so it should not be bundled with
   anything else, and should ship with a regression test built from the
   reproduction in §1.1 (a position where a committed piece's destination
   collides with a different piece's legal move to the same square) before
   any leniency code is touched.
4. **Documentation-only, whenever convenient:** the §3.1 comment noting the
   `maia-spike` ↔ `lc0Encoder.test.ts` dependency, so a future cleanup pass
   doesn't delete `maia-spike` assuming it's inert.
