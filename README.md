# ♚ Blindfold Chess Trainer

A blindfold-chess trainer built with React, TypeScript, and Vite. Play
against a self-hosted Stockfish without seeing the board, using typed or
spoken algebraic notation. Peek for three seconds when you need to rebuild
the position in your head.

## Features

- Play White or Black against eight Stockfish strength levels.
- Enter moves such as `e4`, `Nf3`, `Bxe5`, `O-O`, and `e8=Q` — plus
  descriptive captures (`NxB`), partial input, and fuzzy fallback.
- Voice input that matches what you say against the actual legal moves,
  with push-to-talk degrade on devices where continuous recognition is
  unreliable (notably iOS).
- Spoken move confirmation from generated audio clips (offline-friendly,
  no `speechSynthesis` dependency in the common case).
- Three-second board peek with a peek counter.
- Takeback, legal-move hint, resign, FEN display, and PGN copying.
- Visual custom-position editor, FEN import, and explicit castling-right
  controls with automatic sanitization.
- Local game history and simple statistics.
- Installable PWA with full offline play after the first successful load.
- Light and dark themes. No backend, account, or database.

## Run locally

```bash
npm install
npm run dev
```

The dev server needs internet access once to fetch npm packages; after
`npm run build`, the app (including the vendored Stockfish engine and all
audio clips) is fully self-contained and works offline.

## Build & preview

```bash
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serve dist/ locally
```

## Testing

```bash
npm run test:all   # typecheck -> build -> vitest -> playwright
```

Individually:

```bash
npm run typecheck
npm run test:unit        # vitest — chess & speech services
npm run test:e2e         # playwright — full game flows, desktop + iPhone viewport
```

## Generating assets

Icons already exist in `public/icons/`. Speech clips are generated with the
macOS `say` command and committed to `public/audio/`:

```bash
bash scripts/generate-speech-clips.sh
```

## Deploy to Vercel

Push to `main`. `vercel.json` builds with `npm run build`, serves `dist/`,
and long-caches `public/engine/` and `public/audio/` as immutable.

## Project structure

```text
.
├── src/
│   ├── services/       chess + speech, pure functions, unit tested
│   ├── engine/          EngineAdapter interface + Stockfish adapter
│   ├── state/            Zustand stores (game, settings, speech)
│   ├── api/               the one file that touches localStorage
│   ├── components/         ui / board / screens / play
│   └── hooks/               speech recognition, speech output, theme
├── public/
│   ├── engine/          vendored Stockfish 10.0.2 (asm.js)
│   ├── audio/            generated speech clips
│   └── icons/
├── scripts/
│   └── generate-speech-clips.sh
├── tests/
│   └── e2e/              Playwright specs (unit tests live next to their services)
├── vercel.json
└── docs/BACKLOG.md
```

## Browser notes

Typed play works in all modern browsers. Voice input uses the Web Speech
API (`SpeechRecognition`); Chrome has the most complete support. On iOS,
continuous recognition is unreliable — the app detects this and degrades to
press-and-hold. If the API isn't available at all, the microphone control
is hidden and typed play remains fully functional.

## Credits

Board pieces are the Staunty set (by sadsnake1, via lila and
cm-chessboard), used under CC BY-NC-SA 4.0 — non-commercial, share-alike.
The twelve SVGs are extracted from cm-chessboard's sprite and vendored in
`public/pieces/` so the app works offline. See `CREDITS.md`.
