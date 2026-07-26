import { describe, it, expect, beforeEach } from "vitest";
import { getSpeechMode, setSpeechMode } from "./localStore";

// This module runs under vitest's "node" environment, which has no global
// localStorage — install a minimal in-memory stand-in so getSpeechMode's
// migration path (a real read-then-write) is actually exercised.
function installFakeLocalStorage() {
  const data = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

describe("speech mode: legacy migration", () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  it("has nothing stored yet", () => {
    expect(getSpeechMode()).toBeNull();
  });

  it("migrates the legacy silent value to off", () => {
    localStorage.setItem("blindfoldSpeechMode", "silent");
    expect(getSpeechMode()).toBe("off");
  });

  it("migrates the legacy engine value to on", () => {
    localStorage.setItem("blindfoldSpeechMode", "engine");
    expect(getSpeechMode()).toBe("on");
  });

  it("migrates the legacy both value to on", () => {
    localStorage.setItem("blindfoldSpeechMode", "both");
    expect(getSpeechMode()).toBe("on");
  });

  it("persists the migrated value so the legacy read only happens once", () => {
    localStorage.setItem("blindfoldSpeechMode", "silent");
    getSpeechMode();
    expect(localStorage.getItem("blindfoldSpeechMode")).toBe("off");
  });

  it("passes current off/on values straight through", () => {
    setSpeechMode("off");
    expect(getSpeechMode()).toBe("off");
    setSpeechMode("on");
    expect(getSpeechMode()).toBe("on");
  });
});
