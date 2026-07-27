import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MaiaAdapter } from "./maiaAdapter";
import type { MaiaWorkerRequest, MaiaWorkerResponse } from "./protocol";

/** Loads but never posts "loaded" -- simulates a stalled model download/session-create. */
class HangingWorker {
  onmessage: ((e: MessageEvent<MaiaWorkerResponse>) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  postMessage(_msg: MaiaWorkerRequest): void {}
  terminate(): void {}
}

class ReadyWorker extends HangingWorker {
  postMessage(msg: MaiaWorkerRequest): void {
    if (msg.type === "load") this.onmessage?.({ data: { type: "loaded" } } as MessageEvent<MaiaWorkerResponse>);
    if (msg.type === "requestMove") {
      this.onmessage?.({ data: { type: "move", id: msg.id, uci: "e2e4" } } as MessageEvent<MaiaWorkerResponse>);
    }
  }
}

describe("MaiaAdapter init timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", HangingWorker);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects, disposes, and leaves the adapter not-ready when the model never finishes loading", async () => {
    const adapter = new MaiaAdapter();
    const pending = adapter.init();
    const assertion = expect(pending).rejects.toThrow(/timed out/i);

    await vi.advanceTimersByTimeAsync(25_000);
    await assertion;

    expect(adapter.isReady()).toBe(false);
  });

  it("clears the timer on success, so it never fires after the fact", async () => {
    vi.stubGlobal("Worker", ReadyWorker);

    const adapter = new MaiaAdapter();
    await adapter.init();
    expect(adapter.isReady()).toBe(true);

    await vi.advanceTimersByTimeAsync(25_000);
    expect(adapter.isReady()).toBe(true);
  });
});

describe("MaiaAdapter requestMove / stop", () => {
  it("abandons a superseded request instead of ever resolving it", async () => {
    class SlowWorker extends HangingWorker {
      lastId: number | null = null;
      postMessage(msg: MaiaWorkerRequest): void {
        if (msg.type === "load") this.onmessage?.({ data: { type: "loaded" } } as MessageEvent<MaiaWorkerResponse>);
        if (msg.type === "requestMove") this.lastId = msg.id; // never replies -- simulates an abandoned inference
      }
    }
    vi.stubGlobal("Worker", SlowWorker);

    const adapter = new MaiaAdapter();
    await adapter.init();

    const pending = adapter.requestMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", []);
    const assertion = expect(pending).rejects.toThrow();
    adapter.stop();
    await assertion;
  });
});
