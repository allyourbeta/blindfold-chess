# SPEC: Codebase audit — report only, change nothing

## Why

The app was built as a voice-driven blindfold trainer. Voice input was
removed entirely; input is now a keypad producing exact SAN. Stockfish was
replaced as the opponent by Maia. Each of those changes deleted the modules
that were *obviously* dead — but not the ones that still had callers.

That gap produced a real bug: `moveResolve.ts` carries leniency layers built
to rescue mangled speech (prefix matching, missing-rank shorthands,
piece-plus-file guessing). With a keypad they are worse than useless — an
entry the keypad has already judged illegal got a second chance to be
reinterpreted as something legal. Types checked. Tests passed. Its tests
asserted the leniency as correct.

That is the class of problem this audit is for: **not dead code, but live
code whose reason for existing has expired.** No linter finds it. It takes
asking "why is this here, and is that still true?"

## The one rule

**Change nothing.** No refactors, no deletions, no "while I was in there".
The deliverable is a document. If you find something broken, write it down;
do not fix it. Fixes ship later as small reviewed rounds with their own
tests — that is deliberate, not timidity: this codebase has repeatedly
punished large unattended changes.

The only files you may write are `AUDIT.md` and, if it helps,
supporting notes under `docs/`.

## Preconditions

- Clean tree on `main`. If dirty, STOP and report.
- Branch `audit` (so the report can be reviewed as a diff of one file).
- You do not need the test suite to pass to read code, but note anything
  that fails.

## What to look for

For every module, ask: **who calls this, and is the reason it was written
still true?** Sort findings into these categories and label each one:

1. **Expired purpose** — has callers, but exists to solve a problem the app
   no longer has. The `moveResolve` leniency layers are the exemplar. This
   is the most valuable category and the hardest to see; spend your time
   here.
2. **Unreachable** — no live caller, or reachable only from code that is
   itself unreachable. Trace it, don't guess from a grep.
3. **Vestigial data** — assets, constants, config or persisted keys that
   nothing consumes any more.
4. **Tests that encode superseded intent** — tests that would happily pass
   while the app does the wrong thing, because they assert behaviour that
   was correct under an older design.
5. **Duplication left by a migration** — the same logic in two places
   because something was moved rather than replaced.

## Specific places to start (not exhaustive — keep going after these)

- `src/services/chess/moveResolve.ts` — which layers are still needed now
  that the keypad submits exact SAN via `submitKeypadMove`? Is the move
  branch of `submitMoveText` reachable at all any more?
- `src/services/chess/commands.ts` / `parseTypedCommand` — buttons now call
  `submitMoveText("fen")` and friends, using a text protocol with no text
  input behind it. Is that indirection still earning its place?
- The speech clip inventory: compare `CLIP_IDS` and the phrase tables
  against what `utteranceForEvent` can actually emit today. Voice-era
  outcomes like "not understood" may no longer be reachable. List any `.wav`
  in `public/audio/` that nothing can play.
- `src/state/speechStore.ts` — which fields still have consumers?
- Stockfish: deliberately retained for possible future analysis, so it is
  NOT dead — but confirm it is genuinely inert. Does the app still fetch or
  boot the engine at startup now that Maia plays? If it costs bandwidth or
  memory for nothing, say so with numbers.
- `src/maia-spike/` versus `src/engine/maia/` — what, if anything, is
  duplicated after the integration moved the encoder?
- Root `SPEC_*.md` files — which describe rounds already shipped or
  superseded? (`SPEC_phase2_maia.md` is known to be superseded by
  `SPEC_maia_integrate.md`.)
- Settings and persisted `localStorage` keys — is every one still read, and
  does every one still change behaviour?

## Evidence standard

A finding without evidence is a guess, and guesses have cost this project
real time. Every entry in `AUDIT.md` must carry:

- **What** — file and line range.
- **Why it's suspect** — the original purpose, and what changed.
- **Reachability** — the actual call path from a user action, or a
  demonstration that none exists. Name the callers.
- **Blast radius** — what would break if it were removed. Which tests cover
  it; whether those tests are themselves in category 4.
- **Recommendation** — remove, simplify, keep-with-comment, or investigate
  further — and your confidence, honestly stated.

Where you are unsure, say so plainly. An entry that reads "I could not
determine whether X is reachable, here's what I checked" is more useful than
a confident wrong call.

## Report structure

`AUDIT.md`, ordered by value to a reader, not by directory:

1. **Findings that could cause wrong behaviour** — anything like the
   `moveResolve` bug, where live code can produce a result the current
   design doesn't want. These first, always.
2. **Findings that are merely dead weight** — unreachable code, unused
   assets, stale specs.
3. **Findings that are only untidy** — naming, duplication, comments that
   describe a system that no longer exists.
4. **Open questions** — things you couldn't resolve and what would resolve
   them.

End with a short suggested sequence: which fixes are independent, which
depend on others, and which are risky enough to want their own round.

## Finish

- `AUDIT.md` committed on the `audit` branch. Nothing else changed —
  `git diff --stat main` must show only `AUDIT.md` (plus any `docs/` notes).
- Do NOT push. Do NOT merge.
- In your closing report: how many findings in each category, the three you
  consider most important, and anything about the codebase that surprised
  you.
