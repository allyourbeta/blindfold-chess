import { describe, it, expect, beforeEach, vi } from "vitest";
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
