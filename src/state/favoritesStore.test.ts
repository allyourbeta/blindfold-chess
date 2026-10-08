import { describe, it, expect, beforeEach } from "vitest";
import { useFavorites } from "./favoritesStore";
import { getFavorites } from "@/api/localStore";

// This module runs under vitest's "node" environment, which has no global
// localStorage -- same stand-in as localStore.test.ts.
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

describe("useFavorites", () => {
  beforeEach(() => {
    installFakeLocalStorage();
    useFavorites.setState({ codes: getFavorites() });
  });

  it("starts empty, toggle adds, toggle again removes", () => {
    expect(useFavorites.getState().codes).toEqual([]);
    expect(useFavorites.getState().isFavorite("E001")).toBe(false);

    useFavorites.getState().toggle("E001");
    expect(useFavorites.getState().codes).toEqual(["E001"]);
    expect(useFavorites.getState().isFavorite("E001")).toBe(true);

    useFavorites.getState().toggle("E001");
    expect(useFavorites.getState().codes).toEqual([]);
    expect(useFavorites.getState().isFavorite("E001")).toBe(false);
  });

  it("persists across a reload (re-reading localStorage)", () => {
    useFavorites.getState().toggle("E002");
    useFavorites.setState({ codes: getFavorites() }); // simulate a fresh module load
    expect(useFavorites.getState().codes).toEqual(["E002"]);
  });

  it("a storage failure does not throw", () => {
    (localStorage as unknown as { setItem(): void }).setItem = () => {
      throw new Error("quota exceeded");
    };
    expect(() => useFavorites.getState().toggle("E003")).not.toThrow();
    // The in-memory state still updates even though the write failed.
    expect(useFavorites.getState().isFavorite("E003")).toBe(true);
  });
});
