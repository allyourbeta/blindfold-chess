# SPEC: Keypad move entry — voice input removed

## Context

Voice input is being removed permanently. iOS/WebKit's speech recognizer
leaves the audio session in a broken voice-processing state for the life of
the page; engine speech crackles afterwards and nothing at the page level can
reset it (verified: full recognizer teardown, the Audio Session API, verified
route-probe waits, fresh AudioContexts, a getUserMedia flush, and two
different output voices all failed). Engine speech is perfectly clean when
the microphone is never touched. Therefore: the microphone is never touched.

The player now enters moves on a custom in-app keypad. The engine keeps
responding exactly as today: text in the log AND Tessa clip audio.

## Preconditions (STOP if not met)

- Working tree is clean and on `main`. If dirty, STOP and report.
- `npm run test:all` passes before you start. If not, STOP and report.

## Decided design (do not deviate)

Entry scheme: **piece → destination**, matching spoken SAN.

- Piece moves: tap piece, then file, then rank — N, f, 3 → Nf3.
- Pawn moves: no piece key; start with the file — e, 4 → e4.
  Pawn captures: file, then destination file, then rank — e, d, 5 → exd5.
- Castling: dedicated O-O and O-O-O keys, rendered only when legal.
- Captures and check/checkmate are NEVER entered; they are inferred from the
  position (the SAN the app plays carries x/+/# automatically via chess.js).
- **Context-sensitive keys**: after every tap, any key that cannot extend the
  current entry toward at least one legal move is disabled (dimmed, not
  hidden — layout must never shift).
- **Auto-submit**: the instant the entry prefix matches exactly one legal
  move, that move plays. No confirm key.
- **Disambiguation — industry standard only**: when piece+destination
  matches more than one legal move (e.g. both knights reach d2), show a
  chooser row with the standard SAN disambiguated forms as buttons
  (`Nbd2` / `Nfd2`; rank form `N1d2` / `N5d2` when the file is shared; full
  origin square in the rare double-ambiguity case). Tapping one plays it.
  chess.js already produces these exact SAN strings — derive the labels from
  its legal-move list, never construct them by hand.
- Promotion: after the entry resolves to a promotion, a chooser appears with
  Q first, then R, B, N.
- Undo-last-tap key (⌫) clears one element of the entry; a long entry never
  needs full retype.
- Live preview of the partial entry (e.g. `N f _`) in the slot where the
  transcript preview used to live.
- Desktop: physical keyboard drives the same state machine — keydown n/b/r/q/k
  maps to piece keys, a–h to files, 1–8 to ranks, Backspace to undo-tap.
  The free-text move field is removed on all platforms.

## Part 1 — pure entry service (write this first, with tests)

New file: `src/services/keypad/entry.ts` (pure functions, no React, no DOM,
no chess.js import — it receives plain data).

Model the entry as a state machine over the position's legal moves. Input:
the legal moves as chess.js verbose objects (`{ san, piece, from, to,
promotion, ... }`) plus the current tap sequence. Output, from one function:

```ts
interface EntryState {
  preview: string;            // "N f _" style
  enabled: EnabledKeys;       // which piece/file/rank/castle keys are live
  candidates: LegalMove[];    // legal moves still matching the prefix
  resolved: LegalMove | null; // exactly-one match -> auto-submit this
  disambiguation: string[] | null; // SAN labels for the chooser, else null
  promotionPending: boolean;
}
```

Rules worth encoding as tests (non-exhaustive; add what you find):

- Start position: piece keys enabled only for pieces with legal moves;
  ranks disabled until a file (or piece+file) is chosen.
- `e,4` resolves uniquely and auto-submits `e4`.
- `N,f` then `3` auto-submits `Nf3` when only one knight reaches f3.
- Two knights reaching d2: `N,d,2` yields `disambiguation: ["Nbd2","Nfd2"]`
  and `resolved: null`.
- Rank-style disambiguation (`N1d2`/`N5d2`) when knights share a file.
- Pawn capture `e,d` narrows to exd-moves; `e,d,5` submits `exd5`.
- Promotion: `e,8` (pawn on e7) sets `promotionPending`; choosing Q submits
  `e8=Q` (with `+`/`#` as chess.js emits it).
- Castle keys enabled exactly when `O-O`/`O-O-O` appear in the legal list.
- Undo-tap from any state returns to the previous state exactly.
- A key never enabled: one that cannot reach any legal move (e.g. rank `5`
  after `N,f` when no knight move ends on f5).

Target: this is the round's brain. Aim for the same test density as
`match.test.ts` had. Every bullet above is at least one test.

## Part 2 — keypad component

New file: `src/components/play/MoveKeypad.tsx`, replacing the mic pad in
`PlayScreen`. Layout (existing Palette A tokens, no new colors):

- Row 1: ♔ ♕ ♖ ♗ ♘ piece keys + castle key(s) when legal
- Row 2: a b c d e f g h
- Row 3: 1 2 3 4 5 6 7 8, plus ⌫
- Preview line above the rows; disambiguation/promotion chooser renders in
  the preview line's place when active.
- Keys must be large (this pad is THE control of the game — same prominence
  the mic pad had: full input width, generous height). Disabled keys dim via
  opacity; the grid never reflows.
- Use existing `Button`/`cn` conventions. Remember `lib/cn` is plain clsx —
  no tailwind-merge; use variant switches, not class-append overrides.

While the engine is speaking, the keypad stays visible but inert (same
"Engine speaking…" treatment the mic pad had).

## Part 3 — remove the voice-input path

Delete (code AND their tests):

- `src/hooks/useSpeechRecognition.ts`
- `src/services/speech/recognition.ts`, `match.ts`, `candidates.ts`,
  `grammar.ts`, `normalize.ts`, `echo.ts`
- `src/services/audio/audioSession.ts` (mic-era session juggling; with no
  capture ever, none of it is needed)
- `src/types/speech-recognition.d.ts` if nothing else references it
- e2e: `speech-tap.spec.ts`, `speech-ui.spec.ts`

Keep (the OUTPUT path — untouched behavior):

- `phrase.ts`, `utteranceForEvent.ts`, `clipPlayer.ts`, `master.ts`,
  `sfx.ts`, the speech queue in `useSpeechOutput.ts`, `unlockAudioOutput`
  (gesture unlock is still required for playback).

Adjust:

- `useSpeechOutput.ts`: remove `waitForInputOutputHandoff` and all
  audioSession/flush imports; `IS_IOS` import likely becomes unused — if
  platform detection is still needed anywhere, move the `IS_IOS` constant to
  a small `src/services/platform.ts`; otherwise delete it.
- `speechStore.ts`: remove listening/mode/inputError state; keep
  `isSpeaking`/`speakingEndedAt` if the queue still uses them; delete
  `recentSpokenTexts` machinery if `echo.ts` was its only consumer.
- `gameStore.ts`: remove `submitVoiceMatch` and the `not-understood` audio
  event kind; keypad submission goes through the existing typed-move path
  with `source.kind === "typed"` semantics ("typed moves never read back"
  applies to keypad entries). `rejected-move`/`illegal-move` voice branches
  become unreachable — remove the voice-source variants but KEEP the
  underlying guard: if an illegal SAN somehow reaches the store, it must
  still be rejected silently with a log, never crash.
- `utteranceForEvent.ts` + its tests: drop `not-understood` and
  voice-source cases.
- Settings: the three-way Speech control collapses — with voice input gone,
  "Both" is indistinguishable from "Engine". Replace with a two-state
  control: "Engine speaks: On / Off". Migrate persisted values
  silent→off, engine→on, both→on. Keep the persistence key migration
  explicit and tested in `localStore` fashion used previously.
- Commands (resign etc.): the free-text field is gone, so verify every
  command remains reachable through existing UI buttons; if any command was
  text-only, add it to the menu/action bar rather than silently dropping it,
  and list what you did in the report.
- Home screen settings summary line: update wording to match the new
  two-state speech setting.

## Part 4 — e2e

New `tests/e2e/keypad.spec.ts`:

- Play `e4` by tapping e then 4; assert the move appears in the move list.
- Set up a position (or play into one) with a knight ambiguity; assert the
  chooser shows both standard SAN labels and tapping one plays it.
- Assert disabled keys: at game start, tap N, assert rank keys not
  reachable by any knight move are disabled.
- Desktop project: play a move via physical keydown events.
- Mobile project: the keypad renders and no text input / mic pad exists.

Update any existing e2e that referenced the mic pad or text field
(`game-flow`, `mobile-layout`, `speech-ui` remnants) rather than deleting
assertions wholesale — game-flow must still prove a full game works.

## Part 5 — finish

- Bump `CACHE_NAME` in `public/sw.js` to the next version.
- `npx tsc -b`, `npx vitest run`, `npm run build`, `npm run test:all` all
  green. No file over 300 lines — split `entry.ts` if it grows past that.
- Commit on `main` with a clear message. Do NOT push — Ashish pushes.
- Write a short report: files added/removed/changed, test counts
  before/after, every judgment call you made (especially Part 3's settings
  migration and any command relocation), and anything you deliberately left
  for a follow-up round.
