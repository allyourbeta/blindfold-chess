import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { maskAndSoftmax, pickMove, TEMPERATURE_BY_STOP } from "./policy";
import { encodeMove } from "./encoding/lc0Encoder";

describe("maskAndSoftmax", () => {
  it("zeroes every illegal index and sums to 1 over the legal ones", () => {
    const rawPolicy = [5, -3, 1, 8, -1, 2]; // indices 1, 4 are "illegal"
    const legalIndices = [0, 2, 3, 5];

    const result = maskAndSoftmax(rawPolicy, legalIndices, 1.0);

    expect(result[1]).toBe(0);
    expect(result[4]).toBe(0);
    const sum = legalIndices.reduce((acc, i) => acc + result[i], 0);
    expect(sum).toBeCloseTo(1, 10);
    for (const i of legalIndices) expect(result[i]).toBeGreaterThan(0);
  });

  it("returns an all-zero vector when there are no legal moves", () => {
    const result = maskAndSoftmax([1, 2, 3], [], 1.0);
    expect(Array.from(result)).toEqual([0, 0, 0]);
  });
});

describe("pickMove: each randomness stop behaves as specified", () => {
  // A deliberately lopsided distribution: index 10 is far and away the
  // model's favourite, so sharpening/flattening is easy to tell apart.
  const rawPolicy = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const legalIndices = [1, 5, 10];

  it("Predictable is a true argmax, independent of temperature or the RNG", () => {
    // An RNG that would pick a totally different index under any softmax
    // path -- Predictable must ignore it entirely.
    const rngThatWouldPickSomethingElse = () => 0.01;
    expect(pickMove(rawPolicy, legalIndices, "predictable", rngThatWouldPickSomethingElse)).toBe(10);
  });

  it("Human samples the model's untransformed distribution -- temperature 1, no reshaping", () => {
    expect(TEMPERATURE_BY_STOP.human).toBe(1.0);
    const humanProbs = maskAndSoftmax(rawPolicy, legalIndices, TEMPERATURE_BY_STOP.human);
    const plainSoftmax = maskAndSoftmax(rawPolicy, legalIndices, 1.0);
    expect(Array.from(humanProbs)).toEqual(Array.from(plainSoftmax));
  });

  it("Wild demonstrably flattens the distribution relative to Human", () => {
    const humanProbs = maskAndSoftmax(rawPolicy, legalIndices, TEMPERATURE_BY_STOP.human);
    const wildProbs = maskAndSoftmax(rawPolicy, legalIndices, TEMPERATURE_BY_STOP.wild);
    // The favourite's share should shrink, and a weak alternative's share
    // should grow, once heavily flattened.
    expect(wildProbs[10]).toBeLessThan(humanProbs[10]);
    expect(wildProbs[1]).toBeGreaterThan(humanProbs[1]);
  });

  it("Focused sharpens relative to Human -- the favourite gets an even bigger share", () => {
    const humanProbs = maskAndSoftmax(rawPolicy, legalIndices, TEMPERATURE_BY_STOP.human);
    const focusedProbs = maskAndSoftmax(rawPolicy, legalIndices, TEMPERATURE_BY_STOP.focused);
    expect(focusedProbs[10]).toBeGreaterThan(humanProbs[10]);
  });

  it("Loose flattens relative to Human, less aggressively than Wild", () => {
    const humanProbs = maskAndSoftmax(rawPolicy, legalIndices, TEMPERATURE_BY_STOP.human);
    const looseProbs = maskAndSoftmax(rawPolicy, legalIndices, TEMPERATURE_BY_STOP.loose);
    const wildProbs = maskAndSoftmax(rawPolicy, legalIndices, TEMPERATURE_BY_STOP.wild);
    expect(looseProbs[10]).toBeLessThan(humanProbs[10]);
    expect(looseProbs[10]).toBeGreaterThan(wildProbs[10]);
  });

  it("samples deterministically from an injected RNG -- no statistical flakiness", () => {
    const probs = maskAndSoftmax(rawPolicy, legalIndices, TEMPERATURE_BY_STOP.human);
    const cumulativeBeforeLast = probs[1] + probs[5];

    // Just under the second cumulative boundary -> lands on index 5.
    expect(pickMove(rawPolicy, legalIndices, "human", () => cumulativeBeforeLast - 1e-9)).toBe(5);
    // Just at/over it -> lands on index 10.
    expect(pickMove(rawPolicy, legalIndices, "human", () => cumulativeBeforeLast + 1e-9)).toBe(10);
    // Draw 0 always lands on the first legal index with positive probability.
    expect(pickMove(rawPolicy, legalIndices, "human", () => 0)).toBe(1);
  });
});

describe("pickMove: promotion moves survive the UCI round-trip", () => {
  it("the picked index maps back to a legal move whose UCI keeps its promotion suffix", () => {
    const fen = "8/P6k/8/8/8/8/8/K7 w - - 0 1"; // white pawn one step from promoting on a8
    const chess = new Chess(fen);
    const us = chess.turn() === "w" ? "w" : "b";
    const legalMoves = chess.moves({ verbose: true });
    const legalIndices = legalMoves.map((m) => encodeMove(m.from, m.to, m.promotion, us));
    const moveByIndex = new Map(legalMoves.map((m, k) => [legalIndices[k], m]));

    const queenPromotion = legalMoves.find((m) => m.promotion === "q");
    expect(queenPromotion).toBeDefined();
    const targetIndex = legalIndices[legalMoves.indexOf(queenPromotion!)];

    // Rig a raw policy that overwhelmingly favours the queen promotion, so
    // Predictable's argmax deterministically selects it.
    const rawPolicy = new Array(1858).fill(-100);
    rawPolicy[targetIndex] = 100;

    const chosenIndex = pickMove(rawPolicy, legalIndices, "predictable");
    const chosenMove = moveByIndex.get(chosenIndex);
    expect(chosenMove?.promotion).toBe("q");

    const uci = chosenMove!.promotion
      ? `${chosenMove!.from}${chosenMove!.to}${chosenMove!.promotion}`
      : `${chosenMove!.from}${chosenMove!.to}`;
    expect(uci).toBe("a7a8q");
  });
});
