import { describe, it, expect, vi } from "vitest";
import { OpponentAdapter } from "./opponentAdapter";
import type { EngineAdapter, EngineLevel, OpponentKind } from "./types";

function fakeAdapter(id: string): EngineAdapter {
  return {
    id,
    init: vi.fn(() => Promise.resolve()),
    isReady: vi.fn(() => true),
    setLevel: vi.fn(),
    requestMove: vi.fn(() => Promise.resolve("e2e4")),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("OpponentAdapter", () => {
  it("init picks the adapter getOpponent names, and leaves the other one untouched", async () => {
    const maia = fakeAdapter("maia");
    const stockfish = fakeAdapter("stockfish");
    const adapter = new OpponentAdapter(
      () => "maia",
      () => maia,
      () => stockfish,
    );

    await adapter.init();

    expect(adapter.id).toBe("maia");
    expect(maia.init).toHaveBeenCalledTimes(1);
    expect(stockfish.init).not.toHaveBeenCalled();
  });

  it("switching opponents and re-initing disposes the old adapter and inits the new one", async () => {
    const maia = fakeAdapter("maia");
    const stockfish = fakeAdapter("stockfish");
    let opponent: OpponentKind = "maia";
    const adapter = new OpponentAdapter(
      () => opponent,
      () => maia,
      () => stockfish,
    );

    await adapter.init();
    opponent = "stockfish";
    await adapter.init();

    expect(maia.dispose).toHaveBeenCalledTimes(1);
    expect(stockfish.init).toHaveBeenCalledTimes(1);
    expect(adapter.id).toBe("stockfish");

    // Switching back disposes the one just built and reuses the original
    // Maia instance rather than constructing a fresh one.
    opponent = "maia";
    await adapter.init();
    expect(stockfish.dispose).toHaveBeenCalledTimes(1);
    expect(maia.init).toHaveBeenCalledTimes(2);
    expect(adapter.id).toBe("maia");
  });

  it("delegates isReady, setLevel, requestMove, stop and dispose to the active adapter only", async () => {
    const maia = fakeAdapter("maia");
    const stockfish = fakeAdapter("stockfish");
    const adapter = new OpponentAdapter(
      () => "maia",
      () => maia,
      () => stockfish,
    );
    await adapter.init();

    adapter.isReady();
    expect(maia.isReady).toHaveBeenCalledTimes(1);

    const level: EngineLevel = { label: "Maia 1900", randomness: "human" };
    adapter.setLevel(level);
    expect(maia.setLevel).toHaveBeenCalledWith(level);

    await adapter.requestMove("fen", []);
    expect(maia.requestMove).toHaveBeenCalledWith("fen", []);

    adapter.stop();
    expect(maia.stop).toHaveBeenCalledTimes(1);

    adapter.dispose();
    expect(maia.dispose).toHaveBeenCalledTimes(1);

    expect(stockfish.isReady).not.toHaveBeenCalled();
    expect(stockfish.setLevel).not.toHaveBeenCalled();
    expect(stockfish.requestMove).not.toHaveBeenCalled();
    expect(stockfish.stop).not.toHaveBeenCalled();
  });

  it("requestMove rejects before any init() has ever run", async () => {
    const adapter = new OpponentAdapter(() => "maia");
    await expect(adapter.requestMove("fen", [])).rejects.toThrow(/not initialized/i);
  });
});
