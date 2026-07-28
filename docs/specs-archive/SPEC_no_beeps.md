# SPEC: Beeps must be structurally impossible in speaking modes

Repo: blindfold-chess, branch `main`, working tree. Small, surgical round.
Verify, commit with a conventional message, do NOT push — Ashish pushes.
No file over 300 lines. No new dependencies.

## Background

The user hears confirmation beeps colliding with the spoken move announcements
on iPhone (Engine/Both speech modes), across several fix attempts. The most
recent round (`tonesOn = speechMode === "silent"` gating in
src/hooks/useSpeechOutput.ts, delivered as palette-beeps-20) may or may not
already be applied in this tree — check first. Whether the remaining reports
are a stale build on his phone or a real leak, the outcome of this round must
make the question moot: in Engine and Both modes, the app must be INCAPABLE
of producing a tone, verifiably.

## Requirements

1. **Single choke point.** All tone playback (playMoveTone, playCaptureTone,
   playErrorTone in src/services/audio/sfx.ts) must be reachable from exactly
   one call site, and that call site must be gated on
   `speechMode === "silent"` read at PLAY time (not enqueue time), so a mode
   switched mid-queue can't replay a stale decision. If the current code
   already has the single call site in drainQueue, keep it and move the gate
   to play time; if anything else in src/ can trigger a tone, remove it.

2. **Audit for other sound sources.** Grep the whole of src/ for every use of
   AudioContext, OscillatorNode, createOscillator, createBufferSource, Audio(,
   and speechSynthesis. Enumerate them in your report. The only permitted
   sound producers are: the clip player (word clips), speakText (fallback
   voice), and sfx tones behind the silent-mode gate. Anything else found is
   a bug — remove it.

3. **Silent mode keeps its beeps** (they're the only feedback there), and the
   existing hold-while-listening behavior (don't beep while the mic is
   listening) stays for silent mode.

4. **Regression test.** Add a unit test that exercises the tone-decision
   logic: for speechMode "engine" and "both", assert no tone results for any
   audio event kind (move, capture, illegal, rejected, not-understood,
   game-end); for "silent", assert tones do result. If the current structure
   makes this hard to test (logic buried in the React effect), extract the
   event→utterance decision into a pure function in src/services/ (e.g.
   utteranceForEvent(event, speechMode, fileNaming)) and test THAT — this
   also satisfies the components/services layering better than the current
   inline effect. Keep useSpeechOutput.ts a thin consumer of it.

5. **Version stamp for build verification.** Add a tiny build stamp so the
   user can confirm which build his phone is running — this dispute has
   burned hours tonight. Vite exposes nothing by default, so: define
   `__BUILD_ID__` in vite.config.ts (e.g. a short timestamp string at build
   time), and render it in the menu screen's footer in muted small text
   ("build <id>"). No network, no dependency.

6. Bump `CACHE_NAME` in public/sw.js by one.

## Verification (all must pass before you stop)

1. `npx tsc -b --noEmit`, `npm run build`, `npx vitest run` (with the new
   tests), no file over 300 lines.
2. Report: whether the round-20 gating was present when you started; the full
   audit list from requirement 2 with a verdict per hit; files changed;
   anything you deviated on and why. Commit (don't push); `npm run test:all`
   is Ashish's.
