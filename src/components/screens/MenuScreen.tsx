import { useState } from "react";
import {
  LoaderCircle,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useGameStore } from "@/state/gameStore";
import { useSettingsStore } from "@/state/settingsStore";
import { formatPracticeStats } from "@/services/chess/gameSummary";
import { getGameHistory } from "@/api/localStore";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Share, Plus, X, Download } from "lucide-react";
import { RANDOMNESS_STOPS } from "@/engine/maia/policy";
import { useTheme } from "@/hooks/useTheme";
import { unlockAudioOutput } from "@/hooks/useSpeechOutput";

interface MenuScreenProps {
  onPlay(): void;
  onSetup(): void;
}

const ASSIST_HINT = {
  strict: "All keys stay lit. State every move in full; illegal moves are rejected.",
  assisted: "Keys dim to the legal moves, so you can't enter an impossible square.",
} as const;

/** One line under the speech control, so the choice explains itself. */
const SPEECH_HINT = {
  off: "Nothing is spoken. Moves appear on screen.",
  on: "The engine's moves are spoken aloud.",
} as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-2 block text-base font-semibold text-text-secondary">{label}</span>
      {children}
    </div>
  );
}

export function MenuScreen({ onPlay, onSetup }: MenuScreenProps) {
  const [showSettings, setShowSettings] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const playerColor = useSettingsStore((s) => s.playerColor);
  const setPlayerColor = useSettingsStore((s) => s.setPlayerColor);
  const randomness = useSettingsStore((s) => s.randomness);
  const setRandomness = useSettingsStore((s) => s.setRandomness);
  const fileNaming = useSettingsStore((s) => s.fileNaming);
  const setFileNaming = useSettingsStore((s) => s.setFileNaming);
  const speechMode = useSettingsStore((s) => s.speechMode);
  const assistMode = useSettingsStore((s) => s.assistMode);
  const setAssistMode = useSettingsStore((s) => s.setAssistMode);
  // Read once on mount: history only changes while a game is being played.
  const [practiceStats] = useState(() => formatPracticeStats(getGameHistory()));
  const { advice, install } = useInstallPrompt();
  const [showInstall, setShowInstall] = useState(false);
  const setSpeechMode = useSettingsStore((s) => s.setSpeechMode);

  const engineStatus = useGameStore((s) => s.engineStatus);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const retryEngine = useGameStore((s) => s.retryEngine);

  const engineReady = engineStatus === "ready";
  const engineFailed = engineStatus === "failed";
  const randomnessSummaryLabel = RANDOMNESS_STOPS.find((s) => s.value === randomness)?.label ?? "Human";

  async function handleStart() {
    unlockAudioOutput();
    if (engineFailed) {
      await retryEngine();
      return;
    }
    if (!engineReady) return;
    await startNewGame();
    onPlay();
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
      <header className="relative shrink-0 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:bg-bg-surface-alt"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>

      <main className="relative flex flex-1 flex-col overflow-y-auto px-6 pb-6">
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
          <h1 className="relative mt-4 text-4xl font-extrabold tracking-tight text-text-accent">Mind's Eye</h1>
          {/* Small caps: lets the title dominate without shrinking it. */}
          <p className="relative mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
            The ultimate test of cerebral fitness
          </p>
        </section>

        <section className="mt-7">
          <Button
            className="h-16 w-full text-xl font-extrabold uppercase tracking-[0.2em] shadow-lg"
            disabled={engineStatus === "loading"}
            onClick={() => void handleStart()}
          >
            {engineStatus === "loading" && <LoaderCircle className="h-5 w-5 animate-spin" />}
            {engineStatus === "loading" && "Loading Maia 1900..."}
            {engineFailed && "Engine failed — Retry"}
            {engineReady && "New Game"}
            {engineStatus === "idle" && "Loading Maia 1900..."}
          </Button>

          {/*
            The three things that are actually adjustable, as chips rather
            than a sentence: scannable instead of readable, and each one taps
            straight into the settings. Opponent isn't here — there's only
            one model, so a chip implying a choice would be a lie.
          */}
          <div className="mt-3 grid grid-cols-3 gap-2" id="game-settings-summary">
            {[
              { label: "Color", value: playerColor === "w" ? "White" : "Black" },
              { label: "Variance", value: randomnessSummaryLabel },
              { label: "Speech", value: speechMode === "on" ? "On" : "Off" },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={toggleSettings}
                aria-expanded={showSettings}
                aria-controls="game-settings"
                className="min-h-16 rounded-xl bg-bg-surface-alt px-2 py-2 text-center hover:bg-bg-surface"
              >
                <span className="block text-xs font-semibold text-text-muted">{chip.label}</span>
                <span className="mt-0.5 block text-base font-bold text-text-primary">{chip.value}</span>
              </button>
            ))}
          </div>

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
              className="mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-accent hover:bg-bg-surface-alt"
            >
              <Download className="h-4 w-4" />
              Add Mind&apos;s Eye to your home screen
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
                Mind&apos;s Eye can live on your home screen with its own icon, and works offline once installed.
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

        {showSettings && (
          <Card id="game-settings" className="mt-5 space-y-6 p-5">
            <div>
              <h2 className="text-lg font-extrabold text-text-primary">Game settings</h2>
              <p className="mt-1 text-base text-text-secondary">These choices are remembered for your next game.</p>
            </div>

            <Field label="Play as">
              <SegmentedControl<"w" | "b">
                aria-label="Play as"
                value={playerColor}
                onChange={setPlayerColor}
                options={[
                  { value: "w", label: "White" },
                  { value: "b", label: "Black" },
                ]}
              />
            </Field>

            <Field label="Variance">
              <div className="grid grid-cols-2 gap-2">
                {RANDOMNESS_STOPS.map((stop) => (
                  <button
                    key={stop.value}
                    type="button"
                    onClick={() => setRandomness(stop.value)}
                    aria-pressed={stop.value === randomness}
                    className={
                      "min-h-11 rounded-xl border px-2 text-base font-semibold transition-colors " +
                      (stop.value === randomness
                        ? "border-transparent bg-bg-primary text-text-on-primary"
                        : "border-border-default bg-bg-surface text-text-primary hover:bg-bg-surface-alt")
                    }
                  >
                    {stop.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-base text-text-muted">
                {RANDOMNESS_STOPS.find((s) => s.value === randomness)?.hint}
              </p>
            </Field>

            <Field label="Engine speaks">
              <SegmentedControl<"off" | "on">
                aria-label="Engine speaks"
                value={speechMode}
                onChange={setSpeechMode}
                options={[
                  { value: "off", label: "Off" },
                  { value: "on", label: "On" },
                ]}
              />
              <p className="mt-2 text-base text-text-muted">{SPEECH_HINT[speechMode]}</p>
            </Field>

            <Field label="Keypad assistance">
              <SegmentedControl<"strict" | "assisted">
                aria-label="Keypad assistance"
                value={assistMode}
                onChange={setAssistMode}
                options={[
                  { value: "strict", label: "Strict" },
                  { value: "assisted", label: "Assisted" },
                ]}
              />
              <p className="mt-2 text-base text-text-muted">{ASSIST_HINT[assistMode]}</p>
            </Field>

            {speechMode !== "off" && (
              <Field label="Say files as">
                <SegmentedControl<"letters" | "nato">
                  aria-label="Say files as"
                  value={fileNaming}
                  onChange={setFileNaming}
                  options={[
                    { value: "letters", label: "Alpha" },
                    { value: "nato", label: "NATO" },
                  ]}
                />
              </Field>
            )}
          </Card>
        )}

        {practiceStats && (
          <p className="mt-auto pt-8 text-center text-sm text-text-secondary">{practiceStats}</p>
        )}
        <p className="mt-auto pt-4 text-center text-sm text-text-muted">build {__GIT_COMMIT__} · {__BUILD_TIME__}</p>
      </main>
    </div>
  );
}
