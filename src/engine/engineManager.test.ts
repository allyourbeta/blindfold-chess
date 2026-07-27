import { describe, it, expect, vi } from "vitest";
import { EngineManager } from "./engineManager";
import type { EngineAdapter } from "./types";

function fakeAdapter(): EngineAdapter & { resolveMove(uci: string): void; rejectMove(err: Error): void } {
  let moveResolver: ((uci: string) => void) | null = null;
  let moveRejecter: ((err: Error) => void) | null = null;

  return {
    id: "fake",
    init: () => Promise.resolve(),
    isReady: () => true,
    setLevel: () => {},
    requestMove: () =>
      new Promise<string>((resolve, reject) => {
        moveResolver = resolve;
        moveRejecter = reject;
      }),
    stop: vi.fn(),
    dispose: vi.fn(),
    resolveMove(uci: string) {
      moveResolver?.(uci);
    },
    rejectMove(err: Error) {
      moveRejecter?.(err);
    },
  };
}

const noop = () => {};

describe("EngineManager", () => {
  it("goes through loading -> ready and reports readiness", async () => {
    const adapter = fakeAdapter();
    const statuses: string[] = [];
    const manager = new EngineManager(adapter, { onStatusChange: (s) => statuses.push(s) });
    await manager.load();
    expect(statuses).toEqual(["loading", "ready"]);
    expect(manager.isReady()).toBe(true);
  });

  it("reports failed status when init rejects", async () => {
    const adapter: EngineAdapter = {
      id: "fake",
      init: () => Promise.reject(new Error("boom")),
      isReady: () => false,
      setLevel: () => {},
      requestMove: () => Promise.reject(new Error("n/a")),
      stop: () => {},
      dispose: () => {},
    };
    const manager = new EngineManager(adapter);
    await expect(manager.load()).rejects.toThrow("boom");
    expect(manager.getStatus()).toBe("failed");
  });

  it("applies a bestmove reply that arrives while still current", async () => {
    const adapter = fakeAdapter();
    const manager = new EngineManager(adapter);
    await manager.load();

    const onMove = vi.fn();
    const pending = manager.requestMove("startpos", [], onMove, noop);
    adapter.resolveMove("e2e4");
    await pending;

    expect(onMove).toHaveBeenCalledWith("e2e4");
  });

  it("discards a bestmove reply that arrives after a restart (stale search)", async () => {
    const adapter = fakeAdapter();
    const manager = new EngineManager(adapter);
    await manager.load();

    const onMove = vi.fn();
    const onError = vi.fn();
    const pending = manager.requestMove("startpos", [], onMove, onError);

    // New game / resign / menu — restart happens before the engine replies.
    await manager.restart();

    adapter.resolveMove("e2e4");
    await pending;

    expect(onMove).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(adapter.dispose).toHaveBeenCalled();
  });

  it("dispose() bumps the generation so any in-flight reply is also dropped", async () => {
    const adapter = fakeAdapter();
    const manager = new EngineManager(adapter);
    await manager.load();

    const onMove = vi.fn();
    const pending = manager.requestMove("startpos", [], onMove, noop);
    manager.dispose();
    adapter.resolveMove("e2e4");
    await pending;

    expect(onMove).not.toHaveBeenCalled();
    expect(manager.getStatus()).toBe("idle");
  });

  it("a failed requestMove invokes the error path exactly once", async () => {
    const adapter = fakeAdapter();
    const manager = new EngineManager(adapter);
    await manager.load();

    const onMove = vi.fn();
    const onError = vi.fn();
    const pending = manager.requestMove("startpos", [], onMove, onError);
    adapter.rejectMove(new Error("worker died"));
    await pending;

    expect(onMove).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("a superseded generation stays silent on failure too — no move, no error", async () => {
    const adapter = fakeAdapter();
    const manager = new EngineManager(adapter);
    await manager.load();

    const onMove = vi.fn();
    const onError = vi.fn();
    const pending = manager.requestMove("startpos", [], onMove, onError);
    manager.abortSearch(); // supersedes before the (failed) reply arrives
    adapter.rejectMove(new Error("stop"));
    await pending;

    expect(onMove).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("a bare (none) reply is treated as a genuine failure, not a silent no-op", async () => {
    const adapter = fakeAdapter();
    const manager = new EngineManager(adapter);
    await manager.load();

    const onMove = vi.fn();
    const onError = vi.fn();
    const pending = manager.requestMove("startpos", [], onMove, onError);
    adapter.resolveMove("(none)");
    await pending;

    expect(onMove).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("abortSearch() means a later-arriving reply never reaches onMove", async () => {
    const adapter = fakeAdapter();
    const manager = new EngineManager(adapter);
    await manager.load();

    const onMove = vi.fn();
    const pending = manager.requestMove("startpos", [], onMove, noop);
    manager.abortSearch();
    adapter.resolveMove("e2e4");
    await pending;

    expect(onMove).not.toHaveBeenCalled();
    expect(adapter.stop).toHaveBeenCalledTimes(1);
    expect(adapter.dispose).not.toHaveBeenCalled(); // abortSearch keeps the worker — no full reload
  });

  it("init timeout leaves status failed", async () => {
    vi.useFakeTimers();
    try {
      const adapter: EngineAdapter = {
        id: "fake",
        init: () =>
          new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error("Stockfish init timed out")), 10_000);
          }),
        isReady: () => false,
        setLevel: () => {},
        requestMove: () => Promise.reject(new Error("n/a")),
        stop: () => {},
        dispose: () => {},
      };
      const manager = new EngineManager(adapter);
      const pending = manager.load();
      const assertion = expect(pending).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(manager.getStatus()).toBe("failed");
    } finally {
      vi.useRealTimers();
    }
  });
});
