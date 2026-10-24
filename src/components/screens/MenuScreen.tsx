import { useRef, useState } from "react";
import {
  LoaderCircle,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/state/gameStore";
import { useSettingsStore } from "@/state/settingsStore";
import { formatPracticeStats } from "@/services/chess/gameSummary";
import { getGameHistory } from "@/api/localStore";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Share, Plus, X, Download } from "lucide-react";
import { opponentName, levelLabel } from "@/engine/opponentLabel";
import { useTheme } from "@/hooks/useTheme";
import { unlockAudioOutput } from "@/hooks/useSpeechOutput";
import { promptCreatorUnlock } from "@/state/creatorPrompt";
import { GameSettingsPanel } from "./GameSettingsPanel";

/** Hidden creator unlock (SPEC_final_polish.md): 5 taps on the build line within this window. */
const BUILD_LINE_TAP_WINDOW_MS = 3000;
const BUILD_LINE_TAPS_TO_UNLOCK = 5;

interface MenuScreenProps {
  onPlay(): void;
  onSetup(): void;
  onEndgames(): void;
}

export function MenuScreen({ onPlay, onSetup, onEndgames }: MenuScreenProps) {
  const [showSettings, setShowSettings] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const playerColor = useSettingsStore((s) => s.playerColor);
  const randomness = useSettingsStore((s) => s.randomness);
  const opponent = useSettingsStore((s) => s.opponent);
  const stockfishLevel = useSettingsStore((s) => s.stockfishLevel);
  const speechMode = useSettingsStore((s) => s.speechMode);
  // Read once on mount: history only changes while a game is being played.
  const [practiceStats] = useState(() => formatPracticeStats(getGameHistory()));
  const { advice, install } = useInstallPrompt();
  const [showInstall, setShowInstall] = useState(false);
  const buildLineTaps = useRef<number[]>([]);

  function handleBuildLineTap() {
    const now = Date.now();
    const recent = buildLineTaps.current.filter((t) => now - t < BUILD_LINE_TAP_WINDOW_MS);
    recent.push(now);
    if (recent.length >= BUILD_LINE_TAPS_TO_UNLOCK) {
      buildLineTaps.current = [];
      promptCreatorUnlock();
    } else {
      buildLineTaps.current = recent;
    }
  }

  const engineStatus = useGameStore((s) => s.engineStatus);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const retryEngine = useGameStore((s) => s.retryEngine);

  const engineReady = engineStatus === "ready";
  const engineFailed = engineStatus === "failed";
  const opponentDisplayName = opponentName(opponent);
  const thirdChipLabel = opponent === "stockfish" ? "Level" : "Variance";
  const thirdChipValue = levelLabel(opponent, randomness, stockfishLevel);

  async function handleStart() {
    unlockAudioOutput();
    if (engineFailed) {
      await retryEngine();
      return;
    }
    if (!engineReady) return;
    const ok = await startNewGame();
    if (ok) onPlay();
  }

  function toggleSettings() {
    setShowSettings((visible) => !visible);
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {/*
        Texture, not pattern: 5% opacity, large squares, and masked so it
        dissolves well before it reaches the button. If it ever reads as a
        chessboard rather than as warmth, halve the opacity.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.05,
          backgroundImage: "repeating-conic-gradient(currentColor 0% 25%, transparent 0% 50%)",
          backgroundSize: "88px 88px",
          maskImage: "linear-gradient(#000 0%, transparent 62%)",
          WebkitMaskImage: "linear-gradient(#000 0%, transparent 62%)",
        }}
      />
      {/*
        SPEC_full_app_audit.md: this button used to be `absolute`, which
        left it out of the header's own auto height -- the header rendered
        as padding alone (~24px) while the button it contained actually
        occupied ~60px, so its bottom ~36px floated over whatever `<main>`
        had scrolled up to meet it (reachable for real: a browser scrolling
        a newly-focused settings control into view on this short a
        viewport). A normal-flow, right-aligned child makes the header's
        own box actually contain the button, so nothing below can ever
        scroll under it.
      */}
      <header className="relative z-10 flex shrink-0 justify-end px-5 pb-2 pt-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))]">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          data-flat="icon"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:bg-bg-surface-alt"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>

      <main className="relative flex flex-1 flex-col overflow-y-auto px-6 pb-6 [&>*]:shrink-0">
        <section className="relative flex flex-col items-center text-center">
          {/* Warmth behind the logo so it sits in light rather than on a flat field. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2"
            style={{
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--color-text-accent) 22%, transparent) 0%, transparent 68%)",
            }}
          />
          <img
            src="/icons/icon-512.png"
            alt=""
            aria-hidden="true"
            className="relative h-28 w-28 rounded-[2rem] shadow-lg"
          />
          <h1 className="relative mt-4 text-4xl font-extrabold tracking-tight text-text-accent">Blindfolde</h1>
          {/* Small caps: lets the title dominate without shrinking it. */}
          <p className="relative mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
            <span className="block">The ultimate test</span>
            <span className="block">of cerebral fitness</span>
          </p>
        </section>

        <section className="mt-7">
          <Button
            className="h-16 w-full text-xl font-extrabold uppercase tracking-[0.2em] shadow-lg"
            disabled={engineStatus === "loading"}
            onClick={() => void handleStart()}
          >
            {engineStatus === "loading" && <LoaderCircle className="h-5 w-5 animate-spin" />}
            {engineStatus === "loading" && `Loading ${opponentDisplayName}...`}
            {engineFailed && "Engine failed — Retry"}
            {engineReady && "New Game"}
            {engineStatus === "idle" && `Loading ${opponentDisplayName}...`}
          </Button>

          {/*
            The four things that are actually adjustable, as chips rather
            than a sentence: scannable instead of readable, and each one taps
            straight into the settings.
          */}
          <div className="mt-3 grid grid-cols-[1fr_1.4fr_1fr_1fr] gap-2" id="game-settings-summary">
            {[
              { label: "Color", value: playerColor === "w" ? "White" : "Black" },
              { label: "Opponent", value: opponentDisplayName },
              { label: thirdChipLabel, value: thirdChipValue },
              { label: "Speech", value: speechMode === "on" ? "On" : "Off" },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={toggleSettings}
                aria-expanded={showSettings}
                aria-controls="game-settings"
                className="raised min-h-16 rounded-xl px-1 py-2 text-center"
              >
                <span className="block text-xs font-semibold text-text-muted">{chip.label}</span>
                <span className="mt-0.5 block whitespace-nowrap text-base font-bold text-text-primary">{chip.value}</span>
              </button>
            ))}
          </div>

          <Button className="mt-3 w-full" variant="secondary" disabled={!engineReady} onClick={onEndgames}>
            Endgame Lab
          </Button>

          <Button className="mt-3 w-full" variant="secondary" disabled={!engineReady} onClick={onSetup}>
            Set up a position
          </Button>

          {/*
            Most people don't know a website can live on the home screen with
            its own icon, and that's the difference between "a link I have to
            find" and an app. Shown only when there's actually something to
            do: never when it's already installed, never where no install
            route exists.
          */}
          {advice.kind !== "installed" && advice.kind !== "unavailable" && (
            <button
              type="button"
              onClick={() => setShowInstall(true)}
              className="raised mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-xl px-3 text-base font-semibold text-text-accent"
            >
              <Download className="h-4 w-4" />
              Add Blindfolde to your home screen
            </button>
          )}
        </section>

        {showInstall && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add to home screen"
            className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-bg-base/95 p-6"
            onClick={() => setShowInstall(false)}
          >
            <div
              className="flex w-full max-w-sm flex-col items-center gap-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Show the payoff: this icon is what lands on their home screen. */}
              <img src="/icons/icon-512.png" alt="" aria-hidden="true" className="h-20 w-20 rounded-3xl shadow-lg" />
              <p className="text-base font-semibold text-text-primary">
                Blindfolde can live on your home screen with its own icon, and works offline once installed.
              </p>

              {advice.kind === "prompt" ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    void install();
                    setShowInstall(false);
                  }}
                >
                  Install
                </Button>
              ) : (
                <ol className="w-full space-y-2 text-left text-base text-text-secondary">
                  <li className="flex items-center gap-2">
                    <Share className="h-4 w-4 shrink-0" /> 1. Tap Share in Safari&apos;s toolbar
                  </li>
                  <li className="flex items-center gap-2">
                    <Plus className="h-4 w-4 shrink-0" /> 2. Choose &ldquo;Add to Home Screen&rdquo;
                  </li>
                </ol>
              )}

              <Button variant="secondary" className="w-full" onClick={() => setShowInstall(false)}>
                <X className="h-4 w-4" /> Close
              </Button>
            </div>
          </div>
        )}

        {showSettings && <GameSettingsPanel />}

        {practiceStats && (
          <p className="mt-auto pt-8 text-center text-sm text-text-secondary">{practiceStats}</p>
        )}
        <button
          type="button"
          data-flat="stamp"
          onClick={handleBuildLineTap}
          className="mt-auto min-h-11 w-full pt-4 text-center text-sm text-text-muted"
        >
          build {__GIT_COMMIT__} · {__BUILD_TIME__}
        </button>
      </main>
    </div>
  );
}
