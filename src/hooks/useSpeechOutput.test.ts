import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { useSpeechStore } from "@/state/speechStore";
import { enqueueSpeech, resetSpeechQueue } from "./useSpeechOutput";

/**
 * Drives the real module-level speech queue end to end (enqueueSpeech /
 * resetSpeechQueue), against a fake AudioContext stood in for
 * `window.AudioContext` -- the same shape as clipPlayer.test.ts's fake, but
 * the sources array is swapped per-test via `currentSources` since
 * useSpeechOutput.ts caches its one AudioContext at module scope for the
 * life of the process, so every test in this file shares the same instance.
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
    stop: vi.fn(function stop(this: { stopped: boolean }) {
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

let currentSources: ReturnType<typeof fakeSource>[] = [];

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  sampleRate = 48000;
  destination = {};
  resume = vi.fn(() => Promise.resolve());
  decodeAudioData = vi.fn(() => Promise.resolve({ duration: 0.2 } as AudioBuffer));
  createBufferSource = vi.fn(() => {
    const source = fakeSource();
    currentSources.push(source);
    return source as unknown as AudioBufferSourceNode;
  });
  createGain = vi.fn(() => fakeGain() as unknown as GainNode);
}

vi.stubGlobal("window", { AudioContext: FakeAudioContext, speechSynthesis: undefined });

let clipCounter = 0;
function uniqueClipIds(n: number): string[] {
  return Array.from({ length: n }, () => `test-queue-clip-${++clipCounter}`);
}

/** Yields past a real macrotask, draining the microtask queue the fake fetch/decode chain runs on. */
async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  currentSources = [];
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

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("useSpeechOutput's real queue, against a fake AudioContext", () => {
  it("resetSpeechQueue mid-sequence stops every scheduled source", async () => {
    enqueueSpeech({ clips: uniqueClipIds(3), text: "irrelevant" });
    await flushMicrotasks(); // loading + scheduling

    expect(currentSources).toHaveLength(3);
    expect(currentSources.every((s) => s.started)).toBe(true);

    resetSpeechQueue();
    await flushMicrotasks();

    expect(currentSources.every((s) => s.stopped)).toBe(true);
    expect(useSpeechStore.getState().isSpeaking).toBe(false);
  });

  it("resetSpeechQueue during loading schedules nothing", async () => {
    enqueueSpeech({ clips: uniqueClipIds(2), text: "irrelevant" });
    resetSpeechQueue(); // fires before the fake fetch's promise chain resolves
    await flushMicrotasks();

    expect(currentSources).toHaveLength(0);
    expect(useSpeechStore.getState().isSpeaking).toBe(false);
  });

  it("the next utterance after a reset plays normally", async () => {
    enqueueSpeech({ clips: uniqueClipIds(2), text: "irrelevant" });
    resetSpeechQueue();
    await flushMicrotasks();

    enqueueSpeech({ clips: uniqueClipIds(2), text: "irrelevant" });
    await flushMicrotasks();

    expect(currentSources).toHaveLength(2);
    for (const s of currentSources) s.onended?.();
    await flushMicrotasks();

    expect(currentSources.every((s) => s.started)).toBe(true);
    expect(currentSources.every((s) => !s.stopped)).toBe(true);
    expect(useSpeechStore.getState().isSpeaking).toBe(false);
  });
});
