import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { MenuScreen } from "@/components/screens/MenuScreen";
import { SetupScreen } from "@/components/screens/SetupScreen";
import { PlayScreen } from "@/components/screens/PlayScreen";
import { EndgamesScreen } from "@/components/screens/EndgamesScreen";
import { useGameStore } from "@/state/gameStore";
import { useTheme } from "@/hooks/useTheme";
import type { SizeBucket } from "@/services/endgames/catalog";

type Screen = "menu" | "setup" | "play" | "endgames";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  // The size bucket to land on when the endgames screen is reached from the
  // game-over panel's "Endgames" button -- null means start at its home view.
  const [endgamesBucket, setEndgamesBucket] = useState<SizeBucket | null>(null);
  const initEngine = useGameStore((s) => s.initEngine);
  useTheme();

  function openEndgames(bucket: SizeBucket | null) {
    setEndgamesBucket(bucket);
    setScreen("endgames");
  }

  useEffect(() => {
    void initEngine();
  }, [initEngine]);

  // Spacebar peeks at the board, but only on the play screen itself -- on
  // every other screen Space must behave like any other key and activate
  // whatever button has focus, not get eaten here first.
  useEffect(() => {
    const FOCUSABLE_TAGS = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA"]);
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      if (screen !== "play") return;
      if (document.querySelector('[role="dialog"]')) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && FOCUSABLE_TAGS.has(active.tagName)) return;
      e.preventDefault();
      useGameStore.getState().doPeek();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [screen]);

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
        data-testid="app-frame"
        className={cn(
          // `overflow-clip`, not `overflow-hidden`: both paint identically,
          // but `overflow-hidden` is still a scroll container the browser
          // can move programmatically (e.g. scrolling a tapped/focused
          // descendant into view) even though nothing on screen lets the
          // player scroll it back once it has. `overflow-clip` clips
          // without creating a scrollport, so there is no scroll position
          // for the browser to move in the first place.
          "flex h-dvh w-full max-w-lg flex-col overflow-clip bg-bg-surface sm:h-full sm:max-h-[46rem] sm:rounded-3xl sm:border-2 sm:border-border-emphasis sm:shadow-2xl shortscape:h-dvh shortscape:max-h-none shortscape:max-w-none shortscape:rounded-none shortscape:border-0",
          // The menu holds half a screen of content; play and setup depend on
          // a definite height for the keypad and log. So only the menu hugs
          // its content on desktop, and only there.
          screen === "menu" && "sm:h-auto",
        )}
      >
        {screen === "menu" && (
          <MenuScreen
            onPlay={() => setScreen("play")}
            onSetup={() => setScreen("setup")}
            onEndgames={() => openEndgames(null)}
          />
        )}
        {screen === "setup" && <SetupScreen onBack={() => setScreen("menu")} onPlay={() => setScreen("play")} />}
        {screen === "play" && (
          <PlayScreen onMenu={() => setScreen("menu")} onEndgames={(bucket) => openEndgames(bucket)} />
        )}
        {screen === "endgames" && (
          <EndgamesScreen
            initialBucket={endgamesBucket}
            onMenu={() => setScreen("menu")}
            onPlay={() => setScreen("play")}
          />
        )}
      </div>
    </div>
  );
}
