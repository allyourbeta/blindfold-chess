# SPEC: iOS audio reliability + phone UI round

> **Note (see AUDIT.md §3.2):** Part A4/A5 and B1's mic-button/tap-session
> sections describe code deleted by the keypad round (`SPEC_keypad_input.md`)
> — no mic button remains. Part A1's clip-playback sections still apply.

Repo: blindfold-chess, branch `main`, working tree.
Execute everything below, verify, and leave the changes **uncommitted** for
Ashish's review. Do not deploy. Do not add dependencies. Follow the existing
architecture: components (UI only) → state (zustand) → services (pure/browser
helpers) → api. No file over 300 lines. Read `docs/BACKLOG.md` first if present.

## Background — what is broken on iPhone

Confirmed failure chain from a physical iPhone test of the deployed app:

1. `unlockAudioOutput()` (src/hooks/useSpeechOutput.ts) resumes the shared
   `AudioContext` and plays one muted throwaway `<audio>` element during the
   New Game tap. But the spoken word clips play through *different* cached
   `HTMLAudioElement`s created later, outside any user gesture. iOS blocks
   their `play()`.
2. The fallback, `speakText()` via `speechSynthesis`, is unreliable on iOS:
   utterances can neither start nor error, and its promise waits forever for
   `onend`/`onerror`.
3. Nothing in the speech queue has a timeout, so `drainQueue()` never reaches
   its `finally`, `isSpeaking` sticks at `true` forever, and the echo guard in
   `useSpeechRecognition.handleResult` then discards every transcript. Net
   effect: one voice move works, the engine's reply is silent, and the mic is
   dead for the rest of the session.
4. Secondary: tap-mode recognition sessions are cleaned up only in Safari's
   `onend`, which Safari does not reliably fire. A stale session ref means the
   next tap merely `stop()`s a corpse instead of starting a new session.

The WebAudio tone path (`services/audio/sfx.ts`) is the model that works:
sounds scheduled on the one unlocked `AudioContext` need no per-play gesture.

## Part A — audio reliability

### A1. Play word clips through the unlocked AudioContext

- New file `src/services/audio/clipPlayer.ts`:
  - Owns a `Map<string, AudioBuffer>` plus a `Map<string, Promise<AudioBuffer>>`
    of in-flight loads. Loads `/audio/${id}.wav` via `fetch` +
    `ctx.decodeAudioData`.
  - `preloadClips(ctx, ids)`: kick off loading of all ids, never rejects.
  - `playClip(ctx, id)`: awaits the buffer (with a 3000 ms cap on a load still
    in flight), plays it via `ctx.createBufferSource()`, resolves on
    `source.onended` **with a watchdog**: `buffer.duration * 1000 + 1500` ms,
    whichever comes first. Throws only when the buffer can't be had in time —
    the caller falls back to `speakText`.
- The full clip id list must come from one place. Export a `CLIP_IDS` constant
  from `src/services/speech/phrase.ts` (derive it from the constants already
  there: pieces, files, nato files, ranks, and the special clips —
  cross-check the list against `scripts/` audio generation so nothing is
  missed).
- `unlockAudioOutput()` additionally calls `preloadClips(...)` with all ids.
  Keep the muted-element trick (it also unblocks `speechSynthesis` on some
  iOS versions).
- Delete the `HTMLAudioElement` clip path (`clipCache`, `getClipElement`,
  `playOneClip`) and route `playClipSequence` through `playClip`. One code
  path for all platforms — desktop uses WebAudio too. Keep `CLIP_GAP_MS`.

### A2. Watchdog on the speechSynthesis fallback

Rework `speakText(text)`:

- If the utterance hasn't fired `onstart` within 2000 ms: `speechSynthesis.cancel()`
  and resolve.
- Absolute cap of 8000 ms per utterance regardless: cancel and resolve.
- Still resolve on `onend`/`onerror` as today. Clear all timers on settle.

### A3. Queue can never wedge

In `drainQueue()`, wrap each utterance's playback in its own `try/catch` so no
throw can escape before `finally`. Result: `isSpeaking` is bounded by the sum
of the watchdog caps and always returns to `false`.

### A4. Tap-session lifecycle that never trusts `onend` alone

In `src/hooks/useSpeechRecognition.ts`, tap mode only (continuous mode is
desktop and stays as-is):

- Add one internal `retireTapSession(recognition)` that is idempotent: clears
  `tapSessionRef` (if it still points at this instance), calls
  `setListening(false)`, clears the instance's timers, and calls
  `recognition.stop()` inside try/catch.
- Retire on: the first final result (right after `handleResult` runs), any
  `onerror`, `onend` (kept as one of several triggers, not the only one), and
  an absolute session cap of 12000 ms from `start()`.
- Tapping while listening: call `retireTapSession` directly and also set an
  800 ms fallback timer doing the same, in case Safari ignores `stop()`.
- Tapping while `isSpeaking` is true: do nothing (the button is disabled per
  B-part anyway — this is the belt to that suspender).

### A5. Mic button disabled while the app is speaking

In `PlayScreen.tsx`, tap mode only: `disabled={speech.isSpeaking}` on the mic
button. Rely on the Button component's existing disabled styling for the
dimmed look. With the A2/A3 watchdogs this window is a few seconds at most.

## Part B — phone UI round

### B1. Tap-mode mic button much bigger

`h-20 w-20` (80 px) circle, icon `h-10 w-10`. Same position (right of the
input). Continuous-mode button unchanged at `h-12 w-12`.

### B2. Secondary controls become real buttons

In `src/components/play/ActionBar.tsx`, the secondary row (Speech, Alpha/NATO,
PGN, Resign, New Game) currently uses `variant="ghost"` — borderless text.
Change all five to the enclosed, bordered treatment the primary row
(Peek/Hint/Takeback) uses (`variant="secondary"`), keeping `size="sm"` and the
current row layout. If wrapping gets ugly at 390 px width, prefer two balanced
rows over shrinking labels — check the built app at iPhone width.

### B3. Drop the instructions message at game start

The game-start message log currently prints two system lines; delete the
second one ("Type moves (e4, Nf3, O-O). Commands: peek, hint, takeback, fen,
pgn, history. Spacebar to peek.") wherever it is added (gameFlow/gameStore).
Keep the "Game started. You play White. Strength: …" line. Search
`tests/` for assertions on the removed text and update them.

## Verification (all must pass before you stop)

1. `npx tsc -b --noEmit`
2. `npm run build`
3. `npx vitest run` — keep all existing tests green; add unit tests where the
   logic is pure (e.g. `CLIP_IDS` completeness against the phrase builders).
   Browser-only watchdog behavior may go untested rather than mocked heavily.
4. No file over 300 lines (`grep -c '' <file>`).
5. Bump `CACHE_NAME` in `public/sw.js` to `blindfold-chess-v9`.
6. Report: files changed, anything you deviated on and why. Leave the tree
   uncommitted. Playwright (`npm run test:all`) is run by Ashish afterwards.

## Acceptance (Ashish's manual iPhone script, for reference)

New Game → tap mic, say "e4" → move plays AND the engine's reply is spoken
aloud → mic re-enables within a few seconds → second spoken move is accepted →
speak an illegal move → rejection is spoken → input still works. Desktop
regression: continuous mode behaves exactly as before, no self-hearing loop.
