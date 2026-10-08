import { describe, it, expect, vi, beforeEach } from "vitest";
import { playClipSequence } from "./clipPlayer";

/**
 * A fake AudioContext/AudioBufferSourceNode pair that records start()/stop()
 * calls instead of actually playing anything, plus a fake fetch + ctx so
 * loadClip's network path resolves instantly with a fake AudioBuffer. Each
 * test uses its own unique clip ids -- clipPlayer.ts caches decoded buffers
 * at module scope, and reusing an id across tests would let one test's
 * cached buffer silently skip another test's fetch/decode path.
 */
function fakeSource() {
  return {
    buffer: null as unknown,
    onended: null as (() => void) | null,
    started: false,
    stopped: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(function start(this: { started: boolean }) {
      this.started = true;
    }),
    stop: vi.fn(function stop(this: { stopped: boolean; onended: (() => void) | null }) {
      this.stopped = true;
    }),
  };
}

function fakeGain() {
  return {
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function fakeCtx() {
  const sources: ReturnType<typeof fakeSource>[] = [];
  const ctx = {
    state: "running" as AudioContextState,
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    decodeAudioData: vi.fn(() => Promise.resolve({ duration: 0.2 } as AudioBuffer)),
    createBufferSource: vi.fn(() => {
      const source = fakeSource();
      sources.push(source);
      return source as unknown as AudioBufferSourceNode;
    }),
    createGain: vi.fn(() => fakeGain() as unknown as GainNode),
  };
  return { ctx: ctx as unknown as AudioContext, sources };
}

let clipCounter = 0;
function uniqueClipIds(n: number): string[] {
  return Array.from({ length: n }, () => `test-clip-${++clipCounter}`);
}

/** Yields past a real macrotask, which only runs once the microtask queue is fully drained -- guaranteed to settle the fake fetch/decode promise chain regardless of how many hops it takes. */
async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }),
    ),
  );
});

describe("playClipSequence: cancellation", () => {
  it("aborted while playing: stops every scheduled source and resolves", async () => {
    const { ctx, sources } = fakeCtx();
    const controller = new AbortController();
    const ids = uniqueClipIds(3);

    const playing = playClipSequence(ctx, ids, 50, controller.signal);
    // Let loading + scheduling complete (both are microtask-only, no real timers).
    await flushMicrotasks();

    expect(sources).toHaveLength(3);
    expect(sources.every((s) => s.started)).toBe(true);

    controller.abort();
    await playing;

    expect(sources.every((s) => s.stopped)).toBe(true);
    for (const s of sources) {
      expect(s.disconnect).toHaveBeenCalled();
    }
  });

  it("aborted while still loading: schedules nothing", async () => {
    const { ctx, sources } = fakeCtx();
    const controller = new AbortController();
    const ids = uniqueClipIds(2);

    const playing = playClipSequence(ctx, ids, 50, controller.signal);
    controller.abort(); // fires before the fake fetch's microtask chain resolves
    await playing;

    expect(sources).toHaveLength(0);
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("a fresh call with a new signal after a reset plays normally", async () => {
    const { ctx, sources } = fakeCtx();
    const abortedController = new AbortController();
    abortedController.abort();
    await playClipSequence(ctx, uniqueClipIds(1), 50, abortedController.signal);

    const freshController = new AbortController();
    const ids = uniqueClipIds(2);
    const playing = playClipSequence(ctx, ids, 50, freshController.signal);

    // Resolve naturally via onended instead of the watchdog.
    await flushMicrotasks();
    const freshSources = sources.slice(-2);
    expect(freshSources).toHaveLength(2);
    for (const s of freshSources) s.onended?.();
    await playing;

    expect(freshSources.every((s) => s.started)).toBe(true);
    expect(freshSources.every((s) => !s.stopped)).toBe(true);
  });
});
