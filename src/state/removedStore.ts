import { create } from "zustand";
import { getRemovedCodes, setRemovedCodes } from "@/api/localStore";
import { removePosition, type RemoveResult } from "@/api/removeApi";
import { useCreator } from "./creatorStore";

interface RemovedState {
  /** Catalog codes removed from the app, from this device's point of view -- catalog.ts's visibleEndgames() filters by this. */
  codes: string[];
  /** A one-line note to show right after a successful removal (decision 10), or null once dismissed/expired. */
  note: string | null;
  /** Calls the Remove API for `code`; on success, hides it on this device at once and sets `note`. */
  removeViaApi(code: string): Promise<RemoveResult>;
  clearNote(): void;
  /** Drops any removed code that's no longer in the shipped catalog -- it did its job once the real deploy caught up. */
  prune(shippedCodes: string[]): void;
}

export const useRemovedStore = create<RemovedState>((set, get) => ({
  codes: getRemovedCodes(),
  note: null,
  removeViaApi: async (code) => {
    const password = useCreator.getState().password;
    if (!password) return { ok: false, error: "This device is locked." };

    const result = await removePosition(code, password);
    if (result.ok) {
      const next = get().codes.includes(code) ? get().codes : [...get().codes, code];
      setRemovedCodes(next);
      set({ codes: next, note: `${code} will be gone everywhere in about a minute.` });
    }
    return result;
  },
  clearNote: () => set({ note: null }),
  prune: (shippedCodes) => {
    const valid = new Set(shippedCodes);
    const next = get().codes.filter((code) => valid.has(code));
    if (next.length !== get().codes.length) {
      setRemovedCodes(next);
      set({ codes: next });
    }
  },
}));
