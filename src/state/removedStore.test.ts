import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useRemovedStore } from "./removedStore";
import { useCreator } from "./creatorStore";
import { getRemovedCodes } from "@/api/localStore";
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

describe("useRemovedStore", () => {
  beforeEach(() => {
    installFakeLocalStorage();
    useRemovedStore.setState({ codes: getRemovedCodes(), note: null });
    useCreator.setState({ password: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts empty", () => {
    expect(useRemovedStore.getState().codes).toEqual([]);
  });

  it("removeViaApi: locked device refuses without calling the API", async () => {
    const spy = vi.spyOn(removeApi, "removePosition");

    const result = await useRemovedStore.getState().removeViaApi("E275");

    expect(result.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(useRemovedStore.getState().codes).toEqual([]);
  });

  it("removeViaApi: success hides the code at once, persists it, and sets a note", async () => {
    useCreator.setState({ password: "hunter2" });
    vi.spyOn(removeApi, "removePosition").mockResolvedValue({ ok: true });

    const result = await useRemovedStore.getState().removeViaApi("E275");

    expect(result.ok).toBe(true);
    expect(useRemovedStore.getState().codes).toEqual(["E275"]);
    expect(getRemovedCodes()).toEqual(["E275"]);
    expect(useRemovedStore.getState().note).toMatch(/E275/);
  });

  it("removeViaApi: a server failure changes nothing locally", async () => {
    useCreator.setState({ password: "hunter2" });
    vi.spyOn(removeApi, "removePosition").mockResolvedValue({ ok: false, error: "wrong password" });

    const result = await useRemovedStore.getState().removeViaApi("E275");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("wrong password");
    expect(useRemovedStore.getState().codes).toEqual([]);
    expect(useRemovedStore.getState().note).toBeNull();
  });

  it("clearNote: drops the note", async () => {
    useCreator.setState({ password: "hunter2" });
    vi.spyOn(removeApi, "removePosition").mockResolvedValue({ ok: true });
    await useRemovedStore.getState().removeViaApi("E275");

    useRemovedStore.getState().clearNote();

    expect(useRemovedStore.getState().note).toBeNull();
  });

  it("prune: drops a removed code once it's no longer in the shipped catalog", () => {
    useRemovedStore.setState({ codes: ["E275", "E276"], note: null });

    useRemovedStore.getState().prune(["E276", "E277"]);

    expect(useRemovedStore.getState().codes).toEqual(["E276"]);
    expect(getRemovedCodes()).toEqual(["E276"]);
  });

  it("prune: a no-op change never touches storage", () => {
    useRemovedStore.setState({ codes: ["E276"], note: null });

    useRemovedStore.getState().prune(["E276", "E277"]);

    expect(useRemovedStore.getState().codes).toEqual(["E276"]);
  });
});
