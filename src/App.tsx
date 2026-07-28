import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
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
    <div className="min-h-dvh bg-bg-base text-text-primary sm:flex sm:h-dvh sm:items-center sm:justify-center sm:p-6 shortscape:block shortscape:p-0">
      {/*
        The app frame: full-bleed on phones, a bordered panel from `sm` up.
        A phone on its side is WIDE ENOUGH to trip the `sm` panel rules but
        is still a phone — the 32rem cap left the landscape layout squeezed
        into a floating card with two-thirds of the screen wasted. In
        shortscape the frame goes full-bleed again.
      */}
      <div
        className={cn(
          "flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-bg-surface sm:h-full sm:max-h-[46rem] sm:rounded-3xl sm:border-2 sm:border-border-emphasis sm:shadow-2xl shortscape:h-dvh shortscape:max-h-none shortscape:max-w-none shortscape:rounded-none shortscape:border-0",
          // The menu holds half a screen of content; play and setup depend on
          // a definite height for the keypad and log. So only the menu hugs
          // its content on desktop, and only there.
          screen === "menu" && "sm:h-auto",
        )}
      >
        {screen === "menu" && <MenuScreen onPlay={() => setScreen("play")} onSetup={() => setScreen("setup")} />}
        {screen === "setup" && <SetupScreen onBack={() => setScreen("menu")} onPlay={() => setScreen("play")} />}
        {screen === "play" && <PlayScreen onMenu={() => setScreen("menu")} />}
      </div>
    </div>
  );
}
