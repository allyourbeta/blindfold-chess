# Credits and vendored-code provenance

This app is MIT licensed (see `LICENSE`). It vendors a small amount of code
and data from GPL-3.0 and MIT projects, isolated at the worker boundary the
same way Stockfish already is. This file is the map: what was taken from
where, under what license, and what changed. `LICENSE` points here.

## Board encoding / move decoding (`src/engine/maia/encoding/`)

Moved here from `src/maia-spike/encoding/` once the spike was validated and
the game needed the same code behind its own worker boundary
(`src/engine/maia/maia.worker.ts`) — see SPEC_maia_integrate.md. The spike
page still uses it too (`src/maia-spike/inference/evaluatePosition.ts`
imports from the new location); nothing here was duplicated.

**Source:** [`Xmaster6y/lczerolens`](https://github.com/Xmaster6y/lczerolens),
commit `8b7f336c11b7df73f79fb78d65c9e23094527c90`, **MIT License**.
Files: `src/lczerolens/board.py` (`LczeroBoard`), `src/lczerolens/constants.py`
(`POLICY_INDEX`).

`SPEC_maia_spike.md` pointed at `CSSLab/maia-platform-frontend` first, and it
was read first, per the spec. Its encoder (`src/lib/engine/tensor.ts`,
`src/lib/engine/maia.ts`) turned out to be built for a different, newer
CSSLab model (a single elo-conditioned checkpoint, 18 board planes, explicit
`elo_self`/`elo_oppo` inputs) — not `maia_kdd_1900`/`maia_kdd_1800`, which are
the original 2020 KDD-paper per-rating models and are plain lc0-format
networks (112-plane history input, no elo input, native 1858-move policy).
CSSLab's own tooling for those never reimplements the encoder in an app; it
shells out to the real `lc0` binary. `lczerolens` is a from-scratch,
independently-tested (against the real `lczero.backends` engine bindings, in
its own test suite) implementation of that same standard lc0 encoding, and is
MIT licensed, so it was used instead. See the spike report for the full
research trail.

Ported: `to_config_tensor`, `to_input_tensor` (castling/side-to-move/halfmove
aux planes only — see divergence below on history), `encode_move`,
`decode_move`, `POLICY_INDEX` (1858-entry table, generated verbatim into
`policyIndex.ts` from the source file, not hand-transcribed).

**Divergences from the source** (every one, with reason):

1. **Language: Python → TypeScript.** Not a mechanical import swap — the
   spec anticipated straight TS-to-TS ports from CSSLab; this is a
   cross-language translation. Every function was cross-checked against the
   live Python source (`onnxruntime` + this exact upstream code) for a set of
   test positions before being trusted — see the spike report for the
   comparison results.
2. **`python-chess` → `chess.js`.** This app already depends on `chess.js`;
   adding `python-chess`'s JS equivalent wasn't an option since it doesn't
   exist. Move objects are read via `chess.js`'s `{from, to, promotion}`
   shape instead of `chess.Move`'s `from_square`/`to_square`/`promotion` ints.
3. **`decode_move` bug fix.** The upstream function drops any promotion
   suffix when reconstructing the UCI string, and its guard for "is this a
   pawn reaching the back rank" compares a `chess.Piece` object to a
   piece-type int (`from_piece == chess.PAWN`), which is always `False` in
   `python-chess` — so upstream `decode_move` never reconstructs a promotion
   move at all, for any of the four promotion pieces. Verified by running the
   actual upstream code against a position with a promoting pawn: all four
   legal promotion moves (`a7a8q/r/b/n`) decoded back to the non-promoting
   `a7a8`. Our port keeps the promotion suffix and fixes the piece-type
   check (`from_piece.piece_type === PAWN`), and also checks both back ranks
   (`toSquare >= 56 || toSquare < 8`) since the original only checked rank 8,
   which silently can't fire for a *black* promotion once its square has been
   rotated back to absolute board coordinates. Both fixes are validated by
   this repo's own round-trip test (`lc0Encoder.test.ts`) and cross-checked
   against a hand-fixed copy of the Python original for both colours — see
   the spike report.
4. **History planes are not a straight port of anything.** This app only
   ever has a single FEN, never a real move history (per
   `SPEC_maia_spike.md`'s own note that `moveHistory` is empty for games
   started from a custom FEN). `lczerolens` offers four named
   `InputEncoding` modes for the no-history case, but none of them matches
   what real lc0 actually does at inference time. Real lc0's default
   `HistoryFill` option is `fen_only`; its C++ source
   (`LeelaChessZero/lc0`, GPL-3.0, `src/neural/encoder.cc`,
   `EncodePositionForNN`, read directly — not copied — to confirm this)
   shows that for the legacy `INPUT_CLASSICAL_112_PLANE` format, a single
   known position is **repeated** across all 8 history slots, *unless* that
   position is exactly the standard starting position, in which case history
   beyond the current slot is left zero. `boardToInputPlanes` in
   `lc0Encoder.ts` implements that rule directly. This is the least-verified
   part of the port — it's read from the authoritative source rather than
   copied from a tested implementation — see the spike report for how much
   to trust it and how it was checked.
5. **Dropped, out of scope for a single-FEN spike:** true multi-ply history
   support (`get_next_legal_boards`, the move-stack-walking branch of
   `to_input_tensor`), repetition detection (always 0 here — correctly, per
   point 4, since a lone FEN has no known repetitions), and all
   visualization code (`render_heatmap`).

## Model weights

`maia_kdd_1900` / `maia_kdd_1800`: original weights from
[`CSSLab/maia-chess`](https://github.com/CSSLab/maia-chess), release `v1.0`
(`maia-1900.pb.gz`, `maia-1800.pb.gz`), **GPL-3.0 License**. Converted to
ONNX by lc0's own exporter (confirmed via the ONNX producer metadata — see
`MODELS.md`) and redistributed by
[`Xmaster6y/lczerolens-demo`](https://huggingface.co/spaces/Xmaster6y/lczerolens-demo)
on Hugging Face (space revision `8dc23f4cd812a5497785c2a8a10434cd457d999a`).
Vendored at `public/maia/models/`. Full checksums and shapes in `MODELS.md`.

## Reference-only (read, not copied)

[`LeelaChessZero/lc0`](https://github.com/LeelaChessZero/lc0) (GPL-3.0):
`src/neural/encoder.cc` and `src/neural/shared_params.cc` were read to
determine the correct history-fill behavior (see divergence 4 above). No code
from this repository is included — only the behavior it documents was
translated into `lc0Encoder.ts`.

## Already-vendored GPL component (predates this spike)

`public/engine/stockfish.js`: Stockfish, **GPL-3.0**, compiled to
asm.js/WebAssembly by [niklasf/stockfish.js](https://github.com/niklasf/stockfish.js)
from the official Stockfish engine with multi-variant support from
[ddugovic/Stockfish](https://github.com/ddugovic/Stockfish). Predates this
spike; documented here because `LICENSE` now points at this file for the
full list of vendored GPL components.

## Board pieces (`public/pieces/`)

**Source:** the **Staunty** piece set, by sadsnake1, originally from
[lila](https://github.com/lichess-org/lila/tree/master/public/piece/staunty)
and redistributed in
[`shaack/cm-chessboard`](https://github.com/shaack/cm-chessboard) at
`assets/pieces/staunty.svg`.

**License: CC BY-NC-SA 4.0** — attribution, **non-commercial**, share-alike.
Stricter than the cburnett set it replaced (CC BY-SA 3.0): this app must not
be sold or used commercially while it ships these pieces, and the extracted
files below carry the same license.

**What changed:** cm-chessboard ships all twelve pieces as one 40×40 SVG
sprite. Each piece's `<g>` was extracted verbatim — transforms, paths and
all — into a standalone `<svg viewBox="0 0 40 40">` file (`wK.svg`,
`bQ.svg`, …), so the app never depends on cross-file SVG `<use>`, which
Safari has historically handled unreliably. No artwork was altered.
