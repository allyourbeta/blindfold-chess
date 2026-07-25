import { describe, it, expect, vi } from "vitest";
import { EngineManager } from "./engineManager";
import type { EngineAdapter } from "./types";

function fakeAdapter(): EngineAdapter & { resolveMove(uci: string): void } {
  let moveResolver: ((uci: string) => void) | null = null;

  return {
    id: "fake",
    init: () => Promise.resolve(),
    isReady: () => true,
    setLevel: () => {},
    requestMove: () => new Promise<string>((resolve) => { moveResolver = resolve; }),
    stop: vi.fn(),
    dispose: vi.fn(),
    resolveMove(uci: string) {
      moveResolver?.(uci);
    },
  };
}

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
    const pending = manager.requestMove("startpos", [], onMove);
    adapter.resolveMove("e2e4");
    await pending;

    expect(onMove).toHaveBeenCalledWith("e2e4");
  });

  it("discards a bestmove reply that arrives after a restart (stale search)", async () => {
    const adapter = fakeAdapter();
    const manager = new EngineManager(adapter);
    await manager.load();

    const onMove = vi.fn();
    const pending = manager.requestMove("startpos", [], onMove);

    // New game / resign / menu — restart happens before the engine replies.
    await manager.restart();

    adapter.resolveMove("e2e4");
    await pending;

    expect(onMove).not.toHaveBeenCalled();
    expect(adapter.dispose).toHaveBeenCalled();
  });

  it("dispose() bumps the generation so any in-flight reply is also dropped", async () => {
    const adapter = fakeAdapter();
    const manager = new EngineManager(adapter);
    await manager.load();

    const onMove = vi.fn();
    const pending = manager.requestMove("startpos", [], onMove);
    manager.dispose();
    adapter.resolveMove("e2e4");
    await pending;

    expect(onMove).not.toHaveBeenCalled();
    expect(manager.getStatus()).toBe("idle");
  });
});
