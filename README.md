# ♚ Blindfold Chess Trainer

A browser-based blindfold chess training app. Play against Stockfish without seeing the board — using typed or voice-controlled algebraic notation. Installable as a PWA for offline play.

## Features

- **Blindfold play** — No board visible. Enter moves via keyboard or voice.
- **Voice I/O** — Speak moves ("knight f3", "castle kingside") and hear engine responses (Chrome recommended).
- **Peek** — Briefly reveal the board for 3 seconds.
- **Position setup** — Arrange any position visually or paste a FEN, then play blindfold from there.
- **Adjustable difficulty** — 8 levels from Beginner (~800) to Full Strength.
- **Offline play (PWA)** — Install to your home screen. After first visit, works without internet.
- **Zero backend** — Everything runs in the browser (Stockfish via WASM, chess.js for validation).

## Deploy to Vercel

```bash
cd blindfold-chess
vercel
```

## Local Development

```bash
cd blindfold-chess/public
python3 -m http.server 8080
# Open http://localhost:8080
```

## Project Structure

```
blindfold-chess/
├── public/
│   ├── index.html        # The entire app (HTML + CSS + JS)
│   ├── manifest.json     # PWA manifest
│   ├── sw.js             # Service worker (caching for offline)
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       └── icon-maskable-512.png
├── vercel.json           # Vercel config (static site)
├── .gitignore
└── README.md
```

## Tech Stack

- **chess.js** (0.10.3) — Move validation, game state, check/checkmate detection
- **Stockfish.js** (10.0.2) — Chess engine running as a Web Worker via WASM
- **Web Speech API** — SpeechRecognition (input) + SpeechSynthesis (output)
- **Service Worker** — Cache-first strategy for offline play
- Pure HTML/CSS/JS — no build step, no framework
