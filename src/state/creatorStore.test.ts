import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useCreator } from "./creatorStore";
import { getCreatorPassword } from "@/api/localStore";
import * as removeApi from "@/api/removeApi";

// This module runs under vitest's "node" environment, which has no global
// localStorage -- same stand-in as favoritesStore.test.ts.
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

describe("useCreator", () => {
  beforeEach(() => {
    installFakeLocalStorage();
    useCreator.setState({ password: getCreatorPassword() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts locked", () => {
    expect(useCreator.getState().password).toBeNull();
  });

  it("unlock: a matching password stores it and flips to unlocked", async () => {
    vi.spyOn(removeApi, "verifyCreatorPassword").mockResolvedValue(true);

    const ok = await useCreator.getState().unlock("hunter2");

    expect(ok).toBe(true);
    expect(useCreator.getState().password).toBe("hunter2");
    expect(getCreatorPassword()).toBe("hunter2");
  });

  it("unlock: a wrong password changes nothing", async () => {
    vi.spyOn(removeApi, "verifyCreatorPassword").mockResolvedValue(false);

    const ok = await useCreator.getState().unlock("wrong");

    expect(ok).toBe(false);
    expect(useCreator.getState().password).toBeNull();
    expect(getCreatorPassword()).toBeNull();
  });

  it("lock: clears the stored password", async () => {
    vi.spyOn(removeApi, "verifyCreatorPassword").mockResolvedValue(true);
    await useCreator.getState().unlock("hunter2");

    useCreator.getState().lock();

    expect(useCreator.getState().password).toBeNull();
    expect(getCreatorPassword()).toBeNull();
  });
});
