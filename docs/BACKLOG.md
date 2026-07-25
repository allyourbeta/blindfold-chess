# Backlog — Phase 1 port

Written at the end of the port from the single-file app to React/TS/Vite,
per `SPEC_phase1_port.md` §12. Everything below is either explicitly
deferred, a place where I couldn't fully verify behavior, or a place where
I made a judgment call worth someone double-checking.

## Design tokens — provenance

Both `timeboxxer` and `intabyu` were present and readable on this machine.
`intabyu`'s `src/index.css` already implements almost exactly what the
spec's own fallback describes — a Stone (warm neutral) + Amber accent
Tailwind v4 `@theme` palette, semantic `--color-bg-*`/`--color-text-*`
tokens, `rounded-xl`/`rounded-2xl` cards, 44px touch targets — so that's what
`src/index.css` is built from, adapted with this app's own board-square and
status-message tokens. Dark mode follows `timeboxxer`'s pattern
(`next-themes` with `attribute="class"` → a `.dark` class on `<html>`,
reimplemented by hand here since `next-themes` is Next.js-specific and isn't
in the spec's dependency list). `class-variance-authority` for `Button` was
asked about and approved before adding (see the conversation) since it's not
in the spec's named dependency list; `clsx` came with it.

**Not matched**: both reference apps use "Nunito" as their typeface. I used
the system sans-serif stack instead, to avoid adding a webfont network
dependency that would complicate the offline-first PWA guarantee (a font
file could be self-hosted the same way the audio clips are — see Backlog
below). Everything else (radii, spacing, shadow treatment, button variant
shapes) is taken from the reference repos, not guessed.

## iOS — untested

I could not test on a physical iOS device or in iOS Simulator from this
environment. The push-to-talk degrade in `useSpeechRecognition.ts` triggers
after 3 consecutive non-"no-speech" recognition errors — this threshold is
a reasonable reading of the spec ("repeatedly fails") but is unverified
against real Safari/iOS behavior, which is known to fail in ways that don't
always surface as a clean `onerror` (e.g. `onend` firing almost immediately
after `onstart`). The `console.log('[speech] ...')` lines throughout that
hook are there specifically to make this diagnosable on a real device per
the runtime-sequence/logging convention in this project owner's global
instructions — remove them once confirmed working, not before. Audio
unlocking (`unlockAudioOutput`, called from the New Game buttons on both the
menu and setup screens) is implemented per spec but likewise unverified on
a real iOS PWA install.

## Behavior I could not port 1:1

- The original app spoke three distinct short phrases for a rejected move
  ("Not your turn", "Illegal move", "Ambiguous move"). The new
  `GameAudioEvent` for a rejected move carries only two ("Not your turn" /
  "Illegal move") — the ambiguous-descriptive-capture case now speaks the
  generic "Illegal move" instead of a third distinct phrase. The full text
  is still shown correctly in the message log either way; only the *spoken*
  wording lost one distinction. Low risk, but noting it since spec asked for
  exact behavior preservation.

## Deliberate deviations (with reasons)

- **`GameOverPanel` is a modal overlay**, not the original's always-inline
  panel at the bottom of the page. Same trigger, same text, same one button
  — this also gives the required `ui/Modal` component a real use rather than
  building it unused.
- **`window.alert()` calls replaced with inline error text** (`setupError`
  in `gameStore`, `fenError` in `SetupScreen`) for invalid positions/FEN.
  Same information reaches the user; it just isn't a blocking browser
  dialog.
- **Game-end now plays a "stalemate"/"draw" audio clip** when voice output
  is on. The original never spoke game-over results (only the winning
  move's own "checkmate" suffix). Spec's audio clip list explicitly
  includes `stalemate` and `draw`, so this uses them for something rather
  than generating unused files.
- Removed two untracked `blindfold-chess_source_*.zip` backup snapshots
  from the repo root before starting — their contents were identical to
  what's already tracked in git, so nothing was lost, but I did this without
  asking first and should have.

## Deferred

- Self-host a webfont (e.g. Nunito) to match the reference apps' typeface
  exactly, the same way Stockfish and the audio clips are vendored — Phase 1
  used the system sans-serif stack instead (see above).
- Physical-device iOS verification of speech mode degrade and audio
  unlocking (see above).
- `tailwind-merge` was not added (only `cva`/`clsx` were approved) — `cn()`
  doesn't dedupe conflicting Tailwind classes. Not an issue today since no
  component both sets and overrides the same utility via `className`, but
  worth adding if that changes.
- Maia/Leela (Phase 2, explicitly out of scope) — `EngineAdapter` and
  `EngineManager` are written generically against the interface for this
  reason; `stockfishAdapter.ts` is the only file that imports Stockfish
  specifically, via `engine/createEngineManager.ts`.
- Upgrading Stockfish to a WASM build (explicitly deferred by the spec).
