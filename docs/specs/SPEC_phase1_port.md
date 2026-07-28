# SPEC — Blindfold Chess Trainer, Phase 1

> **Note (see AUDIT.md §3.2):** §7.2-7.3's `SpeechRecognition`/`normalize.ts`/
> `candidates.ts`/`match.ts` stack was fully removed by `SPEC_keypad_input.md`;
> the rest of this document (architecture rules, project structure) still
> describes the current code.

Port the existing single-file app to a maintainable React app, replace the
visual design, and rebuild the speech layer. Deploy to Vercel.

Read this whole document before writing any code.

---

## 0. Read first

1. `public/index.html` in this repo. It is ~1823 lines and contains the entire
   current app. It is the source of truth for existing behaviour.
2. `README.md` and `RELEASE_NOTES.md` in this repo.
3. If `CLAUDE.md` or `docs/` exist in this repo, read them too.
4. The `timeboxxer` and `intabyu` repos on this machine, if present. They are
   the visual reference for Section 5. Look at their Tailwind config, their
   `Button`/`Card` components, their colour tokens and their icon usage.
   Do not guess at these values if the repos are available to read.

Do not start writing code until you have read `public/index.html` end to end.
Several behaviours in it are deliberate bug fixes and are easy to destroy by
accident. They are listed in Section 3.

---

## 1. Goal and non-goals

### Goal

A React + TypeScript + Vite + Tailwind app that:

- preserves every current gameplay behaviour,
- looks like it belongs in the same family as timeboxxer and intabyu,
- has a speech layer that works reliably, including on iPhone,
- installs as a PWA and plays offline,
- deploys to Vercel from a git push.

### Non-goals for Phase 1

Do not build any of these. They are Phase 2 or later.

- Maia / Leela human-like engine. Phase 2. Section 6 requires an engine
  interface that makes Phase 2 an addition rather than a rewrite, but do not
  implement a second engine now.
- User accounts, login, or authentication of any kind.
- Any database. Any server-side API route. Any backend.
- Server-side speech transcription.
- Multiplayer, or any sharing of game history between devices.

The app is a public URL that anyone can open and play. Each person's history
lives in their own browser. There is no server.

---

## 2. Stack and architecture rules

### Stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- Zustand for state
- `lucide-react` for icons
- `chess.js` at current 1.x — **not** the 0.10.3 currently loaded from CDN.
  The 1.x API renames several methods (`in_checkmate()` → `isCheckmate()`,
  `game_over()` → `isGameOver()`, and others). Check the current API rather
  than assuming; do not port 0.10.3 call signatures blindly.
- `vitest` for unit tests, `@playwright/test` for end-to-end tests

Do not add any other runtime dependency without asking first.

### Architecture rules — these are hard requirements

1. No source file over 300 lines. Split immediately if exceeded.
2. Layering: Components (UI only) → State (Zustand) → Services (pure
   functions) → Storage. Dependencies point one direction only.
3. Components contain no game logic. They read state and render.
4. Services are pure functions. No React imports, no `window`, no
   `localStorage`, no direct engine access.
5. All `localStorage` access lives in exactly one module: `src/api/localStore.ts`.
   Nothing else in the codebase may touch `localStorage`. There is no database
   in this project, so this module is what the `api/` layer rule refers to.
6. Before finishing, verify the build passes and no file exceeds 300 lines.

### Directory layout

```
src/
  main.tsx
  App.tsx
  api/
    localStore.ts            only module that touches localStorage
  state/
    gameStore.ts             active game state
    settingsStore.ts         colour, level, voice on/off, theme
    speechStore.ts           listening/speaking flags, transcripts
  services/
    chess/
      fen.ts                 fenToBoard, boardToFEN, validateFen, castling rights
      moveResolve.ts         partial, descriptive and fuzzy move resolution
      san.ts                 SAN → spoken phrase parts
      gameSummary.ts         result text, stats
    speech/
      normalize.ts           transcript normalisation
      candidates.ts          legal move → spoken variants
      match.ts               transcript → best legal move
      phrase.ts              move → ordered list of audio clip ids
    audio/
      sfx.ts                 move/capture/error tones
  engine/
    types.ts                 EngineAdapter interface
    stockfishAdapter.ts      the current engine, behind the interface
    engineManager.ts         lifecycle, restart, stale-reply guarding
  components/
    ui/                      Button, Card, Modal, Toggle, SegmentedControl
    board/                   Board, SetupBoard, Square, PieceGlyph
    screens/                 MenuScreen, SetupScreen, PlayScreen
    play/                    MoveInput, MoveList, MessageLog, ActionBar,
                             PeekPanel, StatusLine, GameOverPanel
  hooks/
    useSpeechRecognition.ts
    useSpeechOutput.ts
    useTheme.ts
public/
  engine/                    self-hosted Stockfish, see Section 6
  audio/                     generated speech clips, see Section 7
  icons/
scripts/
  generate-speech-clips.sh
tests/
```

---

## 3. Behaviour to port

Port all of the following. Line numbers refer to the current
`public/index.html`. Read each function before reimplementing it.

### 3.1 Game flow

| Behaviour | Current location |
| --- | --- |
| Eight difficulty levels, label + depth + skill | `SKILL_LEVELS`, line 330 |
| Play as White or Black | `setColor`, line 692 |
| Start standard game | `startNewGame` / `beginGame`, lines 906, 940 |
| Start from a custom position | `startFromSetup`, line 911 |
| Submit and validate a move | `handleSubmit` / `processPlayerMove`, lines 983, 1073 |
| Request and apply an engine move | lines 1183, 1199 |
| Detect game end | `checkGameOver` / `endGame`, lines 1242, 1255 |
| Takeback a move pair | `doTakeback`, line 1337 |
| Legal-move hint | `showHint`, line 1393 |
| Resign | `doResign`, line 1366 |
| Copy PGN, with clipboard fallback | `copyPGN`, line 1371 |
| Move list and status line | lines 1314, 1328 |
| Message log | `addMsg`, line 1485 |
| Thinking indicator | lines 1493, 1502 |

### 3.2 The peek mechanic

`doPeek`, line 1286. Three-second reveal of the board, then hide. A peek
counter is shown during play and stored with the game.

Preserve this detail: holding the key down for one continuous three-second
peek counts as **one** peek, not many. This was a deliberate fix.

Space bar triggers peek when the move input is not focused.

### 3.3 Position setup

- Visual piece palette and click-to-place board (`buildPalette` line 507,
  `handleSetupClick` line 832)
- Side-to-move toggle
- FEN paste and import (`loadFEN`, line 812). Importing a FEN must preserve
  the side-to-move, en-passant square and both move counters — do not
  regenerate them.
- Four explicit castling-right checkboxes
- `sanitizeCastlingRights` (line 739) removes rights that are impossible for
  the placed position, e.g. a rook that is not on its home square
- `validateFen` (line 766) rejects positions without exactly one king per side

### 3.4 Move entry forms

The typed input accepts more than strict SAN. Keep all of it.

- Standard SAN: `e4`, `Nf3`, `Bxe5`, `O-O`, `e8=Q`
- Descriptive captures: `NxB` meaning "the knight that can capture a bishop"
  (`resolveDescriptiveMove`, line 1005). Only resolves when exactly one legal
  move matches.
- Partial and case-insensitive input (`resolvePartialMove`, line 1034)
- Fuzzy fallback against the legal move list (`fuzzyMatchMove`, line 1738)

### 3.5 Engine lifecycle guards

These exist because of real bugs. Port the behaviour, not necessarily the
code shape.

- A `bestmove` that arrives after the player resigned, started a new game or
  returned to the menu must be discarded, not played.
- Starting a new game while the engine is searching must restart the engine
  safely rather than leave it mid-search.
- Start buttons stay disabled until the engine reports ready.
- Engine load failure shows a retry path, and after a successful retry the
  New Game action must work correctly.

### 3.6 Sounds

Move, capture and error tones, generated with the Web Audio API
(lines 369–415). No audio files. Keep them.

### 3.7 History and stats

`saveGameToHistory` (1429), `getGameHistory` (1456), `showGameHistory` (1462).
Stored in `localStorage`, read and written only through `src/api/localStore.ts`.

Keep the existing stored shape if practical. If you change it, write a
migration that reads the old shape so existing local history is not lost.

---

## 4. What to delete

- The entire `parseVoiceMove` function (line 1632). It is ~100 lines of
  homophone patching — "special" for bishop, "car sale" for castling, "prawn"
  for pawn. Section 7 replaces the whole approach. Do not port these rules.
- `speakMove`'s string-replacement approach (line 1510). Replaced by
  Section 7.4.
- All inline CSS in `public/index.html`.
- All emoji used as icons: 👁 🎤 💡 ⚑ ↻ 📋 ♚ ♟. Replaced by lucide icons.
  **Exception:** the Unicode chess glyphs used to draw pieces on the board
  (`PIECES_UNICODE`, line 327) stay. Those are the piece rendering and were
  deliberately chosen over remote images.
- The CDN `<script>` tag for chess.js. It becomes an npm dependency.
- The runtime `fetch` of Stockfish from cdnjs. See Section 6.

---

## 5. Design

### Direction

Match timeboxxer and intabyu. This is not a free brief. If those repos are
present on this machine, read them and derive the actual tokens: palette,
type scale, border radius, shadow treatment, button variants, spacing scale.
Reuse their component structure where it fits.

If they are not present, use this fallback and flag it in your summary so it
can be corrected:

- Background: warm off-white `#f3efe9`
- Surfaces: white with `stone-200` borders
- Text: `slate-900` primary, `slate-600` secondary
- Accent: a single warm amber, used sparingly
- A sans typeface. Not a serif. The current Georgia is being removed.
- Icons: `lucide-react` only

### Rules

- Every colour, radius and spacing value comes from Tailwind tokens or the
  config. No arbitrary hex values scattered through components.
- One `Button` component with variants. No per-screen button CSS.
- Light and dark themes, toggled and persisted. Follow the pattern used in
  timeboxxer.
- Mobile first. The primary device is an iPhone. Test at 390px wide.
- Respect `prefers-reduced-motion`.
- Visible keyboard focus rings.
- Touch targets at least 44px.

### Layout notes

- The three screens (menu, setup, play) become routed or conditionally
  rendered views. Routing is not required for three screens; keep it simple
  unless you have a reason.
- The play screen is the one that matters. On a phone, the move input and the
  microphone control must be reachable with a thumb and must not be covered
  by the keyboard.
- Use `h-dvh`, not `h-screen`, for full-height layout. Do not use
  `position: fixed` for the app shell.
- Respect iOS safe-area insets.

---

## 6. Engine

### Self-host Stockfish

Stop fetching from cdnjs at runtime. Vendor the engine into
`public/engine/`.

Keep the current engine version — stockfish.js 10.0.2, asm.js, about 1 MB.
It works, it is small, and raw strength is explicitly not a goal for this
project. Do not upgrade to a WASM build in Phase 1.

Self-hosting fixes two things: the first visit no longer needs the CDN, and
offline play becomes reliable.

Load it as a Web Worker from the vendored file rather than via
`fetch` + `Blob`, unless the worker fails to construct that way, in which case
keep the blob approach and say so.

### Difficulty levels

Unchanged. Two UCI commands per move, exactly as now:

```
setoption name Skill Level value <skill>
go depth <depth>
```

The eight `SKILL_LEVELS` entries carry the numbers. Do not change them.

### Engine interface

Define `EngineAdapter` in `src/engine/types.ts`. Phase 2 will add a second
implementation (Maia via ONNX Runtime Web) behind this same interface, so the
rest of the app must never import the Stockfish adapter directly.

Minimum surface:

```ts
interface EngineAdapter {
  readonly id: string;
  init(): Promise<void>;
  isReady(): boolean;
  setLevel(level: EngineLevel): void;
  requestMove(fen: string, moveHistory: string[]): Promise<string>; // UCI move
  stop(): void;
  dispose(): void;
}
```

`moveHistory` is not needed by Stockfish. Include it anyway — Maia needs the
previous positions, and adding it later means changing every call site.

`engineManager.ts` owns the lifecycle: readiness, restart-on-new-game, and
discarding replies from a superseded search. That guarding logic lives here,
not in the adapter and not in components.

---

## 7. Speech

This is the largest new piece of work. Read the whole section before starting.

The current approach fails in two ways: it tries to parse arbitrary English,
and it depends on browser speech APIs that are weak on iOS. Both are fixed
here without adding a server.

### 7.1 The core idea

At any moment there are about 30 legal moves. Never parse free English.
Generate the spoken forms of every legal move, then pick the nearest one to
what was heard.

"night to f three", "knight f3" and "night ff3" all land on the same legal
move because they are all closer to it than to anything else in the list.

### 7.2 Recognition

Use the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).

- `continuous: true`, `interimResults: false`, `maxAlternatives: 5`
- Feed **every** alternative into the matcher, not just the first. Score them
  all and take the best overall match.
- Restart recognition on `onend` while listening is enabled.
- Suppress the `no-speech` error; it is normal.

**iOS handling.** Continuous recognition is unreliable on iOS Safari,
especially in an installed PWA. Detect this and degrade rather than fail:

- Feature-detect at startup.
- If continuous recognition is unavailable or repeatedly fails, switch the
  microphone control to push-to-talk: press and hold to listen, release to
  submit. Show which mode is active.
- If speech is entirely unavailable, hide the microphone control and show a
  one-line explanation. Typed play must remain fully functional.

**Half-duplex.** Stop recognition while the app is speaking, and restart it
after. Do not use a timing cooldown to detect the app hearing itself — the
current 1.5-second window is a workaround for a problem that disappears if
the microphone is simply off while speaking.

### 7.3 Matching

`services/speech/` holds this and it is all pure functions, so it is all unit
testable. Test it thoroughly.

**normalize.ts** — lowercase; number words to digits; NATO alphabet to file
letters (alpha→a, bravo→b, charlie→c, delta→d, echo→e, foxtrot→f, golf→g,
hotel→h); collapse whitespace. Keep this small. It is not the place to fix
mishearings.

**candidates.ts** — for each legal move from `chess.moves({ verbose: true })`,
generate the plausible spoken variants. For `Nf3` that includes at least:
`knight f3`, `knight to f3`, `knight f three`, `n f3`. For `Bxe5`:
`bishop takes e5`, `bishop x e5`, `bishop captures e5`. Include castling,
promotion and disambiguated forms (`Nbd2` → `knight b d2`, `knight from b to d2`).

**match.ts** — score the normalized transcript against every candidate string
for every legal move. Use a character-level edit distance normalized by
length. Return the best move plus a confidence.

Acceptance policy:

- If the best score is above a threshold **and** clearly better than the
  second-best distinct move, play it.
- If two moves are close, do not guess. Show both and ask, or fall back to
  showing what was heard without playing.
- If nothing is close, show what was heard. Never play a move the user did
  not ask for.

Always display what was heard and what it resolved to, as the app does now.

**Voice commands** stay: peek, takeback, resign, hint, new game. Match these
before move matching, and require a close match so "e4" cannot become
"resign".

### 7.4 Spoken output

Replace `speechSynthesis` as the primary path with composed audio clips.

Chess notation has a tiny vocabulary. About 35 short clips cover every
possible move announcement. Composed clips sound identical every time, work
offline, and avoid the iOS voice-list-loads-late problem entirely.

**Clip set** — one file each for:

- pieces: king, queen, rook, bishop, knight, pawn
- files: a b c d e f g h
- ranks: 1 2 3 4 5 6 7 8
- connectors: takes, to, from, check, checkmate, castles kingside,
  castles queenside, promotes to, en passant, stalemate, draw

**Generation is automated.** Write `scripts/generate-speech-clips.sh` that
produces every clip using the macOS `say` command and converts to a
web-friendly format:

```
say -v <voice> -o <name>.aiff "<text>"
afconvert -f WAVE -d LEI16@22050 <name>.aiff <name>.wav
```

Pick one clear voice, make it a variable at the top of the script, and commit
the generated `.wav` files into `public/audio/`. Do not ask the user to
record anything.

**Phrase building** — `services/speech/phrase.ts` takes a chess.js verbose
move object and returns an ordered list of clip ids. Build from the verbose
object (`piece`, `from`, `to`, `captured`, `promotion`, `san`), not by
string-replacing the SAN text. `Nbd2` becomes
`[knight, from, b, to, d, 2]`. `exd5` becomes `[pawn, e, takes, d, 5]`.

**Playback** — sequential, with a small consistent gap. Preload and cache the
clips. Do not start the next clip until the previous one has finished.

**Fallback** — if a clip is missing or audio playback fails, fall back to
`speechSynthesis`. Keep that path working but do not make it primary.

**Unlocking** — iOS requires a user gesture before audio can play. Unlock the
audio context on the first tap of the New Game button and keep the reference.

---

## 8. PWA and offline

- Keep the service worker, updated for the Vite build output.
- Precache: the app shell, the vendored Stockfish, all speech clips, all icons.
- After one successful load, the app must play fully offline. Verify this.
- `public/icons/` may be missing from this repo. Check. If icons are absent,
  generate all four (192, 512, maskable 512, apple-touch) from a single source
  image with a script — do not create them by hand and do not ask the user to.
- Keep the existing manifest fields, updating the theme colour to match the
  new design.

---

## 9. Deployment

- Vercel, static build, deployed by pushing to `main`. Same setup as
  timeboxxer. No `vercel --prod` step.
- Update `vercel.json` for the Vite output directory and add an SPA rewrite.
- Add long-cache headers for `public/engine/` and `public/audio/`, which are
  immutable.
- Do not configure COOP/COEP headers. They are not needed for this engine
  build and they complicate things later.

---

## 10. Testing

Provide a single command:

```
npm run test:all
```

It must run: typecheck, build, unit tests, then end-to-end tests.

### Unit tests — vitest

The services layer is pure, so cover it properly:

- FEN round-trip, validation, castling-right sanitation
- Move resolution: SAN, partial, descriptive, fuzzy
- Speech normalization
- Candidate generation for a range of positions
- Matching, including the ambiguity rejection case
- Phrase building for: quiet move, capture, castling both sides, promotion,
  disambiguated move, check, checkmate

### End-to-end tests — Playwright

Port the four existing smoke tests in `tests/smoke_test.py` and add to them:

1. Normal game start, player move, engine reply
2. Recovery after an initial Stockfish load failure
3. Custom-position castling-right sanitation
4. Resign while the engine is thinking
5. New game while the engine is thinking
6. Peek reveals the board and hides after three seconds
7. Takeback restores the previous position
8. A mobile-viewport project at iPhone size, verifying the play screen layout

Speech cannot be tested end to end in headless Chromium. Cover the speech
services entirely with unit tests, and verify the microphone control renders
and degrades correctly when the API is absent.

---

## 11. Acceptance criteria

Do not report done until all of these hold.

- [ ] `npm run test:all` passes.
- [ ] No file in `src/` exceeds 300 lines.
- [ ] No component imports from `src/engine/` or `src/api/` directly.
- [ ] No service imports React, `window` or `localStorage`.
- [ ] `localStorage` appears in exactly one file.
- [ ] No emoji in the UI except the Unicode chess piece glyphs.
- [ ] No hardcoded hex colours outside the Tailwind config.
- [ ] `parseVoiceMove` and its homophone rules do not exist anywhere.
- [ ] Stockfish loads from `public/engine/`, with no network request to cdnjs.
- [ ] All eight difficulty levels present, with unchanged depth and skill values.
- [ ] The app plays a full game offline after one online load.
- [ ] Play screen usable one-handed at 390px wide.

---

## 12. Reporting

When finished, write `docs/BACKLOG.md` with anything deferred, and give a
short summary covering:

- whether the timeboxxer/intabyu repos were readable, and which design tokens
  were taken from them versus guessed
- which speech mode iOS resolved to in your testing, if you could test it
- any behaviour from `public/index.html` you could not port, and why
- any place you deviated from this spec, and why

Ask before deviating on anything in Section 2 or Section 11.
