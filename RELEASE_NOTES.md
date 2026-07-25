# Release notes

## Finished MVP — July 2026

This pass turns the existing app into a release-ready personal MVP without changing its single-file architecture.

### Fixed

- Added all missing PWA and Apple Home Screen icons.
- Restored the correct New Game action after a successful Stockfish retry.
- Disabled standard/custom game startup until the engine is actually ready.
- Prevented late Stockfish replies from leaking into a resigned or restarted game.
- Restarted Stockfish safely when a new game is requested during an engine search.
- Added real FEN validation, including exactly one king per side.
- Preserved imported FEN side-to-move, en-passant, and move-counter fields.
- Added explicit custom-position castling-right controls and removed impossible rights automatically.
- Replaced remote chess-piece images with local Unicode rendering.
- Made service-worker installation tolerate temporary external-CDN failures.
- Improved offline navigation fallback and cache cleanup.
- Added clipboard fallback for browsers without the Clipboard API.
- Avoided counting repeated presses during one continuous three-second peek as multiple peeks.

### Added

- Four generated application icons, including a maskable icon.
- Static packaging checks and four headless browser smoke tests.
- Clearer setup, deployment, testing, and browser-support documentation.

### Remaining platform limitations

- The first successful visit still requires internet access for `chess.js` and Stockfish; the PWA caches both for later offline use.
- Speech recognition availability and quality depend on the browser and operating system.
- Physical-device PWA installation, especially on iPhone, remains a final manual acceptance check.
