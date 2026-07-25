import { useEffect } from "react";
import { useSettingsStore } from "@/state/settingsStore";

/** Applies the persisted theme as a class on <html> so Tailwind's `dark:` variant picks it up. */
export function useTheme() {
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return { theme, toggleTheme };
}
