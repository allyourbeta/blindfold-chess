import { create } from "zustand";
import { getFavorites, setFavorites } from "@/api/localStore";

interface FavoritesState {
  codes: string[];
  isFavorite(code: string): boolean;
  toggle(code: string): void;
}

/**
 * Favorited endgame codes, backed by localStorage. A zustand store (rather
 * than a plain hook reading localStorage directly) so every screen showing a
 * star or a count re-renders the moment any one of them toggles one.
 */
export const useFavorites = create<FavoritesState>((set, get) => ({
  codes: getFavorites(),
  isFavorite: (code) => get().codes.includes(code),
  toggle: (code) => {
    const current = get().codes;
    const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    setFavorites(next);
    set({ codes: next });
  },
}));
