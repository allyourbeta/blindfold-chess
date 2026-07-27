import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StockfishAdapter } from "./stockfishAdapter";

/** Loads but never posts "uciok"/"readyok" — simulates a stalled Stockfish worker. */
class HangingWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  postMessage(_msg: string): void {}
  terminate(): void {}
}

describe("StockfishAdapter init timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", HangingWorker);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects and disposes the worker when readyok never arrives", async () => {
    const adapter = new StockfishAdapter();
    const pending = adapter.init();
    const assertion = expect(pending).rejects.toThrow(/timed out/i);

    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;

    expect(adapter.isReady()).toBe(false);
  });

  it("clears the timer on success, so it never fires after the fact", async () => {
    class ReadyWorker extends HangingWorker {
      postMessage(msg: string): void {
        if (msg === "uci") this.onmessage?.({ data: "uciok" } as MessageEvent);
        if (msg === "isready") this.onmessage?.({ data: "readyok" } as MessageEvent);
      }
    }
    vi.stubGlobal("Worker", ReadyWorker);

    const adapter = new StockfishAdapter();
    await adapter.init();
    expect(adapter.isReady()).toBe(true);

    // If the init timer were still armed, advancing past it would tear the
    // engine back down even though init already succeeded.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(adapter.isReady()).toBe(true);
  });
});
