import { create } from "zustand";
import { getCreatorPassword, setCreatorPassword, clearCreatorPassword } from "@/api/localStore";
import { verifyCreatorPassword } from "@/api/removeApi";

interface CreatorState {
  /** The password this device unlocked with, or null when locked. */
  password: string | null;
  /** Checks `password` against the server and, if it matches, unlocks this device. Returns whether it matched. */
  unlock(password: string): Promise<boolean>;
  lock(): void;
}

/**
 * Whether this device can see and use the app's Remove button
 * (SPEC_pos_page_and_remove.md Part 4) -- backed by localStorage so the
 * unlock survives a reload, same pattern as useFavorites.
 */
export const useCreator = create<CreatorState>((set) => ({
  password: getCreatorPassword(),
  unlock: async (password) => {
    const ok = await verifyCreatorPassword(password);
    if (ok) {
      setCreatorPassword(password);
      set({ password });
    }
    return ok;
  },
  lock: () => {
    clearCreatorPassword();
    set({ password: null });
  },
}));
