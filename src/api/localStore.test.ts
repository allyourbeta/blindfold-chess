import { describe, it, expect, beforeEach } from "vitest";
import {
  getSpeechMode,
  setSpeechMode,
  getShowTicker,
  setShowTicker,
  getAssistMode,
  setAssistMode,
  getRandomness,
  setRandomness,
  getOpponent,
  setOpponent,
  getStockfishLevel,
  setStockfishLevel,
} from "./localStore";

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

describe("ticker and assist defaults", () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  it("ticker defaults to hidden and round-trips", () => {
    expect(getShowTicker()).toBe(false);
    setShowTicker(true);
    expect(getShowTicker()).toBe(true);
  });

  it("assist defaults to strict, round-trips, and rejects junk", () => {
    expect(getAssistMode()).toBe("strict");
    setAssistMode("assisted");
    expect(getAssistMode()).toBe("assisted");
    localStorage.setItem("blindfoldAssistMode", "banana");
    expect(getAssistMode()).toBe("strict");
  });

  it("randomness defaults to human, round-trips through every stop, and rejects junk", () => {
    expect(getRandomness()).toBe("human");
    for (const stop of ["predictable", "focused", "human", "loose", "wild"] as const) {
      setRandomness(stop);
      expect(getRandomness()).toBe(stop);
    }
    localStorage.setItem("blindfoldRandomness", "banana");
    expect(getRandomness()).toBe("human");
  });

  it("opponent defaults to maia, round-trips, and rejects junk", () => {
    expect(getOpponent()).toBe("maia");
    setOpponent("stockfish");
    expect(getOpponent()).toBe("stockfish");
    setOpponent("maia");
    expect(getOpponent()).toBe("maia");
    localStorage.setItem("blindfoldOpponent", "banana");
    expect(getOpponent()).toBe("maia");
  });

  it("stockfish level defaults to club, round-trips through every stop, and rejects junk", () => {
    expect(getStockfishLevel()).toBe("club");
    for (const level of ["easy", "club", "strong", "max"] as const) {
      setStockfishLevel(level);
      expect(getStockfishLevel()).toBe(level);
    }
    localStorage.setItem("blindfoldStockfishLevel", "banana");
    expect(getStockfishLevel()).toBe("club");
  });
});
