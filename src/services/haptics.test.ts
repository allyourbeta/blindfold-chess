import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * This project's unit tests run in vitest's "node" environment (see
 * vite.config.ts) -- there is no real DOM, which is exactly the "document
 * is missing" case haptics.ts itself guards against. The switch-label path
 * is exercised here against a minimal fake document, in the same style as
 * useSpeechOutput.test.ts's fake AudioContext, rather than pulling in jsdom
 * as a new dependency.
 */
function fakeElement(tag: string) {
  return {
    tagName: tag.toUpperCase(),
    style: {} as Record<string, string>,
    attrs: {} as Record<string, string>,
    tabIndex: 0,
    click: vi.fn(),
    setAttribute(name: string, value: string) {
      this.attrs[name] = value;
    },
    getAttribute(name: string) {
      return this.attrs[name];
    },
    appendChild: vi.fn((child: unknown) => child),
  };
}

function fakeDocument() {
  const inputs: ReturnType<typeof fakeElement>[] = [];
  const labels: ReturnType<typeof fakeElement>[] = [];
  const createElement = vi.fn((tag: string) => {
    const el = fakeElement(tag);
    if (tag === "input") inputs.push(el);
    if (tag === "label") labels.push(el);
    return el;
  });
  return { document: { createElement, body: { appendChild: vi.fn() } }, inputs, labels };
}

/**
 * haptics.ts caches its hidden <input>/<label> pair at module scope, so each
 * test gets its own fresh module instance via resetModules() + a dynamic
 * import -- otherwise a later test would reuse the element (and spies) a
 * previous test already wired up.
 */
async function freshHaptics() {
  vi.resetModules();
  return import("./haptics");
}

describe("haptics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("with navigator.vibrate available", () => {
    it("hapticTap calls vibrate with 10", async () => {
      const vibrate = vi.fn();
      vi.stubGlobal("navigator", { vibrate });
      const { hapticTap } = await freshHaptics();

      hapticTap();
      expect(vibrate).toHaveBeenCalledWith(10);
    });

    it("hapticError calls vibrate with the three-buzz pattern", async () => {
      const vibrate = vi.fn();
      vi.stubGlobal("navigator", { vibrate });
      const { hapticError } = await freshHaptics();

      hapticError();
      expect(vibrate).toHaveBeenCalledWith([30, 60, 30, 60, 30]);
    });
  });

  describe("without navigator.vibrate", () => {
    it("hapticTap clicks the hidden switch label, creating the input only once", async () => {
      vi.stubGlobal("navigator", {});
      const { document: fakeDoc, inputs, labels } = fakeDocument();
      vi.stubGlobal("document", fakeDoc);
      const { hapticTap } = await freshHaptics();

      hapticTap();
      hapticTap();

      expect(inputs).toHaveLength(1);
      expect(inputs[0].attrs.switch).toBe("");
      expect(inputs[0].attrs["aria-hidden"]).toBe("true");
      expect(labels).toHaveLength(1);
      expect(labels[0].click).toHaveBeenCalledTimes(2);
    });

    it("hapticError taps three times about 80ms apart", async () => {
      vi.useFakeTimers();
      vi.stubGlobal("navigator", {});
      const { document: fakeDoc, labels } = fakeDocument();
      vi.stubGlobal("document", fakeDoc);
      const { hapticError } = await freshHaptics();

      hapticError();
      expect(labels[0].click).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(80);
      expect(labels[0].click).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(80);
      expect(labels[0].click).toHaveBeenCalledTimes(3);
    });
  });

  it("never throws when document is missing", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", undefined);
    const { hapticTap, hapticError } = await freshHaptics();

    expect(() => hapticTap()).not.toThrow();
    expect(() => hapticError()).not.toThrow();
  });
});
