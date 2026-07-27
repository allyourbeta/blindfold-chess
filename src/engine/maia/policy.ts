import type { RandomnessStop } from "@/engine/types";

/**
 * Temperature applied to raw policy logits before softmax, one per
 * randomness stop (SPEC_maia_integrate.md). "Human" is 1.0 by definition --
 * exactly the model's own distribution, no transformation. "Predictable"
 * has no entry: it's a true argmax (see `pickMove`), not a very-low-
 * temperature softmax, so it never touches this table.
 *
 * These are starting points, not tuned constants -- Ashish will retune them
 * by feel after playing. That's the whole reason they live in one small,
 * named table: change a number here, nothing else in the app needs to know.
 *
 * Reasoning for the starting values:
 * - Focused (0.5): halves the logit spread, letting the model's own top
 *   preference(s) dominate more than they naturally would -- sharper, but
 *   short of deterministic (that's Predictable's job, not a low
 *   temperature's).
 * - Loose (1.6): softmax flattens sub-linearly in temperature -- small
 *   upward steps from 1.0 barely change anything for typical policy logit
 *   spreads, so this is deliberately a large-enough step to feel looser.
 * - Wild (2.75): broadens the tail enough that a plausible-but-not-favourite
 *   move, and occasionally a genuinely weak one, becomes a live
 *   possibility, without flattening all the way to uniform-over-legal-moves.
 */
export const TEMPERATURE_BY_STOP: Record<Exclude<RandomnessStop, "predictable">, number> = {
  focused: 0.5,
  human: 1.0,
  loose: 1.6,
  wild: 2.75,
};

export const RANDOMNESS_STOPS: ReadonlyArray<{ value: RandomnessStop; label: string; hint: string }> = [
  { value: "predictable", label: "Predictable", hint: "Always the top move." },
  { value: "focused", label: "Focused", hint: "Sharpened: strong preferences dominate." },
  { value: "human", label: "Human", hint: "Faithful to the model's own probabilities." },
  { value: "loose", label: "Loose", hint: "Flattened: unlikely moves appear more often." },
  { value: "wild", label: "Wild", hint: "Strongly flattened: expect the occasional bad move." },
];

/**
 * Masks a raw policy vector (e.g. lc0's 1858-move output) down to
 * `legalIndices`, applies `temperature`, and renormalises. Every illegal
 * index is exactly 0 in the result; the legal ones sum to 1 (for a
 * non-empty `legalIndices`).
 */
export function maskAndSoftmax(
  rawPolicy: ArrayLike<number>,
  legalIndices: readonly number[],
  temperature: number,
): Float64Array {
  const out = new Float64Array(rawPolicy.length);
  if (legalIndices.length === 0) return out;

  const scaled = legalIndices.map((i) => rawPolicy[i] / temperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  legalIndices.forEach((idx, k) => {
    out[idx] = exps[k] / sum;
  });
  return out;
}

/**
 * Picks one of `legalIndices` per the randomness stop `stop`, given the raw
 * policy vector they were scored in. `rng` returns a fresh value in [0, 1)
 * per call -- production passes `Math.random`, tests inject a fake one so
 * sampling is deterministic instead of statistical.
 */
export function pickMove(
  rawPolicy: ArrayLike<number>,
  legalIndices: readonly number[],
  stop: RandomnessStop,
  rng: () => number = Math.random,
): number {
  if (legalIndices.length === 0) throw new Error("No legal moves to pick from");

  if (stop === "predictable") {
    let best = legalIndices[0];
    for (const i of legalIndices) if (rawPolicy[i] > rawPolicy[best]) best = i;
    return best;
  }

  const probabilities = maskAndSoftmax(rawPolicy, legalIndices, TEMPERATURE_BY_STOP[stop]);
  const draw = rng();
  let cumulative = 0;
  for (const idx of legalIndices) {
    cumulative += probabilities[idx];
    if (draw < cumulative) return idx;
  }
  return legalIndices[legalIndices.length - 1]; // floating-point rounding guard
}
