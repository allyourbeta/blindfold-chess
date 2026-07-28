# SPEC: Act on the audit

## Context

`AUDIT.md` (branch `audit`) is the input to this round. Read it first — it
carries the evidence, line numbers and call paths behind every item here,
and this spec will not repeat them.

**One thing changed after the audit was written.** The audit was produced
against code that predates the fix now on `main`: `MoveKeypad` no longer
calls `submitMoveText`. It calls `submitKeypadMove`, which matches the
entry against `chess.moves()` exactly and never touches `resolveMoveInput`.

The consequence is large and must be verified before anything else:
`resolveMoveInput`'s only caller is `attemptMove`'s non-exact path, whose
only caller is `submitMoveText`'s default case, whose only live callers are
the FEN and History buttons — both intercepted by `parseTypedCommand` first.
If that holds, **the whole of `moveResolve.ts` is unreachable**, and the
audit's §1.1 and §1.2 become a deletion rather than a redesign.

## Preconditions (STOP if not met)

- Clean tree on `main`, `npm run test:all` green. If not, STOP and report.
- Branch `cleanup`. Commit **each part separately** so any single part can
  be reverted without unpicking the others. Do NOT push, do NOT merge.

## Part 1 — the move resolver (do this first, and alone)

**1a. Prove the reachability claim before deleting anything.** Trace every
caller of `resolveMoveInput`, `attemptMove` and `submitMoveText`. If any
path can still deliver free text to the resolver, STOP this part, leave the
module in place, and report what you found — the rest of the spec is
independent and can proceed.

**1b. Write the regression test first, while the old code still exists.**
Build it from the audit's reproduction in §1.1: a position where the
committed piece's stated destination collides with a *different* piece's
legal move to the same square (the audit used
`4k3/8/8/8/8/2B5/P7/4K3 w - - 0 1`, pawn entry `e5`, bishop's `Be5` legal).
Assert that entering it through the keypad's own submission path is
**rejected** — not played, not substituted. This test must pass before and
after the deletion; it is the proof that the behaviour we care about
survives it.

**1c. Then delete** `src/services/chess/moveResolve.ts` and
`moveResolve.test.ts`, and simplify `attemptMove` to the exact-match path
only (the `exact` parameter becomes unconditional and can go).

Note for the report: `moveResolve.test.ts:82-85` asserts the voice-era
leniency as correct behaviour. It is being deleted along with the code it
describes — say so explicitly rather than letting a test count silently
drop.

## Part 2 — the command indirection

Per audit §2.4. The FEN and History buttons route a text string through a
parser to reach store methods that five sibling buttons call directly.

Add explicit store actions for those two, matching the shape of `doPeek` /
`requestHint` / `copyPgn`. Point the buttons at them. Then delete
`submitMoveText`, `src/services/chess/commands.ts` and `commands.test.ts`.

If Part 1 stopped, this part still applies — but leave `submitMoveText` in
place and only add the direct actions.

## Part 3 — dead audio

Per audit §2.1, §2.2, §2.3. All three are independent of each other and of
everything above.

- Delete `src/services/audio/sfx.ts` (three tone functions, zero callers).
- Delete `rejectionPhraseClips` from `phrase.ts` and its block in
  `phrase.test.ts`. The live path is `rejectionClips` in
  `utteranceForEvent.ts`, already covered by `utteranceForEvent.test.ts`.
- Remove the `ambiguous`, `not-understood` and `to` clips: the `.wav` files,
  their entries in `SpokenPart` / `SPECIAL_PARTS` / `CLIP_SPEECH_TEXT`, and
  — important, easy to miss — the corresponding entries in
  `scripts/generate-speech-clips.sh`, so a future regeneration doesn't
  resurrect them.

Do NOT bump `AUDIO_VERSION`: no surviving clip's *contents* change, and the
constant exists to defeat immutable caching of changed files.

Confirm `CLIP_IDS` and the generation script still agree afterwards — they
are two lists that must stay in step.

## Part 4 — the Stockfish precache

Per audit §2.5. `public/engine/stockfish.js` is ~1.5 MB, precached by the
service worker for every visitor on every version bump, for an engine the
app never instantiates.

Remove `'/engine/stockfish.js'` from `APP_SHELL`. Leave `StockfishAdapter`
and its tests exactly as they are — keeping the engine available for a
future analysis feature is a deliberate decision, and this changes nothing
about that. Add a one-line comment where the entry was, saying why it isn't
precached and what to do if analysis mode ever ships.

## Part 5 — documentation

- Move `SPEC_phase2_maia.md` and `SPEC_no_beeps.md` to `docs/specs-archive/`.
  Both describe designs since fully replaced. Do not delete them; they are
  history.
- Add a header note to `SPEC_phase1_port.md` and `SPEC_ios_audio_ui.md`
  saying which sections no longer describe the code (the speech-recognition
  stack and the mic button respectively). One or two lines each; do not
  rewrite them.
- Per audit §3.1, add a comment at the top of
  `src/engine/maia/encoding/lc0Encoder.test.ts` recording that it imports
  from `src/maia-spike/` — so a future cleanup doesn't delete that tree
  assuming it's inert. This is the cheapest finding in the audit and
  prevents the most expensive mistake.

## What not to do

- Do not touch `src/maia-spike/`. It ships, and production tests depend on
  it.
- Do not "improve" anything not listed here. Every past round where an agent
  tidied adjacent code cost a debugging session.
- Do not change any user-visible behaviour. If a deletion would alter what
  the player sees or hears, stop and report instead.

## Finish

- Bump `CACHE_NAME` in `public/sw.js` (Part 4 changes the precache list).
- `npx tsc -b`, `npx vitest run`, `npm run build`, `npm run test:all` green.
- Grep the e2e suite for any string or button you changed — that omission
  has broken this suite twice.
- Separate commit per part, on `cleanup`. Do NOT push.
- Report: what Part 1's reachability trace actually showed, test counts
  before and after with an explanation of every test that disappeared, the
  three audit open questions if you happened to resolve any, and anything
  you chose not to do.
