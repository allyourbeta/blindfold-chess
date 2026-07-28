import { describe, it, expect, beforeEach, vi } from "vitest";
import { Chess } from "chess.js";
import { useGameStore } from "./gameStore";

// doPeek() doesn't touch the engine, so this is safe to unit test without a
// Worker (the engine's own lifecycle is covered by engineManager.test.ts and
// the Playwright e2e suite).
describe("doPeek: one continuous hold counts as one peek", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("does not increment the counter for repeats while still peeking", () => {
    const { doPeek } = useGameStore.getState();

    doPeek(); // simulates the first keydown of a held key
    expect(useGameStore.getState().peekCount).toBe(1);
    expect(useGameStore.getState().isPeeking).toBe(true);

    doPeek(); // key-repeat keydown while still within the 3s window
    doPeek();
    doPeek();
    expect(useGameStore.getState().peekCount).toBe(1);

    vi.advanceTimersByTime(3000);
    expect(useGameStore.getState().isPeeking).toBe(false);

    doPeek(); // a genuinely new peek after the window closed
    expect(useGameStore.getState().peekCount).toBe(2);

    vi.useRealTimers();
  });
});

// AUDIT.md §1.1: a pawn-committed keypad entry whose stated destination is
// only reachable by a *different* piece must be rejected outright, never
// silently replayed as that other piece's move. Regression test for the
// bug reproduced there (bishop on c3, pawn on a2 — "e5" is not a legal pawn
// move, but Be5 is). Written while moveResolve.ts still exists and must
// keep passing after it's deleted: submitKeypadMove never routes through
// it either way, which is the point.
describe("submitKeypadMove: a fully-stated illegal entry is rejected, not reinterpreted as another piece's move", () => {
  it("does not replay a pawn's illegal 'e5' as the bishop's legal Be5", () => {
    const startFen = "4k3/8/8/8/8/2B5/P7/4K3 w - - 0 1";
    const chess = new Chess(startFen);
    useGameStore.setState({
      chess,
      fen: chess.fen(),
      turn: chess.turn(),
      playerColor: "w",
      gameOverFlag: false,
    });

    useGameStore.getState().submitKeypadMove("e5");

    // Rejected: the position must be untouched — specifically, not Be5.
    expect(useGameStore.getState().chess.fen()).toBe(startFen);
    expect(useGameStore.getState().audioEvent).toMatchObject({
      kind: "illegal-move",
      attempted: "e5",
    });
  });
});
