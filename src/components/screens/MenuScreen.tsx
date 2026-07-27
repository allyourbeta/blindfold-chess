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
    <div className="flex h-full w-full flex-col">
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

      <main className="flex flex-1 flex-col overflow-y-auto px-6 pb-6">
        <section className="flex flex-col items-center text-center">
          <img
            src="/icons/icon-512.png"
            alt=""
            aria-hidden="true"
            className="h-28 w-28 rounded-[2rem] shadow-sm"
          />
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-text-accent">Mind's Eye</h1>
          <p className="mt-1 text-lg font-semibold text-text-primary">The ultimate test of cerebral fitness</p>
          {/* Who you're facing — a fact, not a setting. There is one model. */}
          <p className="mt-2 text-base font-semibold text-text-secondary">Maia 1900</p>
        </section>

        <section className="mt-7">
          <Button
            className="h-14 w-full text-lg font-extrabold"
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
        </section>

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

        <p className="mt-auto pt-8 text-center text-sm text-text-muted">build {__GIT_COMMIT__} · {__BUILD_TIME__}</p>
      </main>
    </div>
  );
}
