# Maia model manifest

This is the deliverable that makes the integration round safe. Every fact
below was determined by inspecting the actual files (`onnxruntime` in Python,
`onnx` for graph metadata), not assumed from documentation. See
`SPEC_maia_spike.md` and the spike report for how these were found and why
they are NOT the files CSSLab's own frontend ships.

## Why these files, from this source

`maia_kdd_1900` / `maia_kdd_1800` are the original per-rating models from the
2020 KDD paper (`CSSLab/maia-chess`, GPL-3.0, release `v1.0`), distributed
there only as lc0 weight files (`maia-1900.pb.gz`, `maia-1800.pb.gz`) — plain
drop-in replacements for the `lc0` engine binary, no ONNX export of its own.
CSSLab's web frontend (`maia-platform-frontend`) does not run these models at
all; it runs a different, newer, single-checkpoint, elo-conditioned model
family (their "maia2"/"maia3" research) with an incompatible input/output
shape. See `CREDITS.md` and the spike report for the full story.

The two `.onnx` files below are lc0's own official ONNX export of the actual
KDD weight files (producer metadata confirms this — see below), published by
a third party (`Xmaster6y/lczerolens-demo` on Hugging Face) whose parent
library exists specifically to run inference on lc0-family nets, including
Maia. They were not converted by us, and not hand-converted by that party
either — the producer field shows lc0's own exporter did the conversion.

## maia_kdd_1900.onnx

| Field | Value |
|---|---|
| Source | `https://huggingface.co/spaces/Xmaster6y/lczerolens-demo/resolve/main/demo/onnx-models/maia-1900.onnx` |
| HF space revision | `8dc23f4cd812a5497785c2a8a10434cd457d999a` |
| Original weights | `CSSLab/maia-chess`, release `v1.0`, `maia-1900.pb.gz` |
| Vendored at | `public/maia/models/maia_kdd_1900.onnx` |
| sha256 | `65ee89dcee614d2b7f5bf8fc5950e83050bf855ecb4d34f6e6214b09acc64572` |
| Size | 3,484,716 bytes (3.32 MiB) |
| ONNX opset | 17 (domain `""`/ai.onnx) |
| IR version | 4 |
| Producer | `Lc0 0.31.0-dev+git.7de98a11` (lc0's own ONNX exporter, not a hand conversion) |

## maia_kdd_1800.onnx

| Field | Value |
|---|---|
| Source | `https://huggingface.co/spaces/Xmaster6y/lczerolens-demo/resolve/main/demo/onnx-models/maia-1800.onnx` |
| HF space revision | `8dc23f4cd812a5497785c2a8a10434cd457d999a` |
| Original weights | `CSSLab/maia-chess`, release `v1.0`, `maia-1800.pb.gz` |
| Vendored at | `public/maia/models/maia_kdd_1800.onnx` |
| sha256 | `8b9b999de7d0fe4b2efc9d6591b30f4010ec7490c36676dd920ee0420f202a67` |
| Size | 3,483,901 bytes (3.32 MiB) |
| ONNX opset | 17 (domain `""`/ai.onnx) |
| IR version | 4 |
| Producer | `Lc0 0.31.2+git.3cb6720` |

Both models are the standard lc0 "classical" network shape: input `112, 8,
8`, no elo/rating input at all (each file already is a specific rating
checkpoint).

## Input

| Name | Shape | Dtype |
|---|---|---|
| `/input/planes` | `[batch, 112, 8, 8]` | `float32` |

Standard lc0 `INPUT_CLASSICAL_112_PLANE` layout: 8 history slots x 13 planes
(12 piece planes + 1 repetition plane) = 104, then 4 castling planes, 1
side-to-move plane, 1 halfmove-clock plane, 1 unused zero plane, 1 all-ones
plane = 112. See `src/engine/maia/encoding/lc0Encoder.ts` for the exact
per-plane layout and, importantly, the history-fill rule this app uses (it
only ever has a single FEN, never real history).

## Output

| Name | Shape | Dtype | Meaning |
|---|---|---|---|
| `/output/policy` | `[batch, 1858]` | `float32` | Raw logits over lc0's 1858-move policy index |
| `/output/wdl` | `[batch, 3]` | `float32` | (win, draw, loss) probabilities from the side-to-move's perspective |

### Is the policy output logits or probabilities?

**Logits.** Determined empirically, not assumed:

- Ran the start position through `maia_kdd_1900.onnx`. The 1858 raw policy
  values range from about -8.7 to +14.1 and sum to about -4330 — not a valid
  probability distribution (must be non-negative, sum to 1).
- Cross-referenced against `lczero.backends`, the real lc0 Python bindings,
  which expose two distinct accessors on a raw evaluation: `p_raw()` (what
  the network head actually outputs) and `p_softmax()` (softmax applied by
  the caller). The ONNX graph's bare `/output/policy` output is `p_raw`;
  softmax is something a consumer must apply itself, over the *legal* move
  subset only — the same convention both `lczerolens` and CSSLab's own
  (differently-shaped) frontend code use.

### Is the WDL output logits or probabilities?

**Probabilities**, already softmaxed. Determined empirically: the three
values for the start position are `[0.4895, 0.0547, 0.4558]`, which sum to
1.0 and are all in `[0, 1]`. `lczerolens`' own `model.py` computes
`value = wdl @ [1, 0, -1]` directly with no softmax step first, which is
only correct if `wdl` is already normalized.

The (win, draw, loss) axis order is inferred from that same dot product
(`win*1 + draw*0 + loss*(-1)` gives a sensible value in `[-1, 1]`) combined
with the plausible result at the start position (white very slightly
favoured to move) — this is the one number in this manifest not directly
confirmed against an independent authoritative source, see the spike report.

## Runtime

Self-hosted ONNX Runtime Web WASM runtime at `public/maia/ort/`
(`ort-wasm-simd-threaded.wasm` + its `.mjs` loader glue, both required, from
`onnxruntime-web@1.27.0`, the only new dependency this round). `numThreads =
1` (no COOP/COEP headers on this app, so no WASM threads). Execution
provider: `wasm` only (no WebGPU on iOS Safari, WebGL is maintenance-mode).
Vite's resolve `conditions` is set to `onnxruntime-web-use-extern-wasm` (see
`vite.config.ts`) so the bundler doesn't also inline its own second copy of
the wasm binary.
