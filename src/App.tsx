import { useEffect, useState } from "react";
import { MenuScreen } from "@/components/screens/MenuScreen";
import { SetupScreen } from "@/components/screens/SetupScreen";
import { PlayScreen } from "@/components/screens/PlayScreen";
import { useGameStore } from "@/state/gameStore";
import { useTheme } from "@/hooks/useTheme";

type Screen = "menu" | "setup" | "play";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const initEngine = useGameStore((s) => s.initEngine);
  useTheme();

  useEffect(() => {
    void initEngine();
  }, [initEngine]);

  // Spacebar peeks at the board whenever the move/FEN input isn't focused.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      if (document.activeElement instanceof HTMLInputElement) return;
      e.preventDefault();
      useGameStore.getState().doPeek();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-dvh bg-bg-base text-text-primary sm:flex sm:h-dvh sm:items-center sm:justify-center sm:p-6">
      {/* The app frame: full-bleed on phones, a bordered panel from `sm` up. */}
      <div className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-bg-surface sm:h-full sm:max-h-[46rem] sm:rounded-3xl sm:border-2 sm:border-border-emphasis sm:shadow-2xl">
        {screen === "menu" && <MenuScreen onPlay={() => setScreen("play")} onSetup={() => setScreen("setup")} />}
        {screen === "setup" && <SetupScreen onBack={() => setScreen("menu")} onPlay={() => setScreen("play")} />}
        {screen === "play" && <PlayScreen onMenu={() => setScreen("menu")} />}
      </div>
    </div>
  );
}
