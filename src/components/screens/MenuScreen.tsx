import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Moon,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { HowToPlay } from "./HowToPlay";
import { useGameStore } from "@/state/gameStore";
import { useSettingsStore, SKILL_LEVELS } from "@/state/settingsStore";
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

const SPEECH_SUMMARY = {
  off: "Silent",
  on: "Engine speaks",
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
  const [showHelp, setShowHelp] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const playerColor = useSettingsStore((s) => s.playerColor);
  const setPlayerColor = useSettingsStore((s) => s.setPlayerColor);
  const skillIndex = useSettingsStore((s) => s.skillIndex);
  const setSkillIndex = useSettingsStore((s) => s.setSkillIndex);
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
  const selectedSkill = SKILL_LEVELS[skillIndex] ?? SKILL_LEVELS[0];
  const setupSummary = `${playerColor === "w" ? "White" : "Black"} · ${selectedSkill.label} · ${SPEECH_SUMMARY[speechMode]}`;

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
    setShowHelp(false);
  }

  function toggleHelp() {
    setShowHelp((visible) => !visible);
    setShowSettings(false);
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
          <p className="mt-1 max-w-xs text-base font-semibold text-text-secondary">
            No chessboard? No problem!
          </p>
        </section>

        <section className="mt-7">
          <Button
            className="h-14 w-full text-lg font-extrabold"
            disabled={engineStatus === "loading"}
            onClick={() => void handleStart()}
          >
            {engineStatus === "loading" && <LoaderCircle className="h-5 w-5 animate-spin" />}
            {engineStatus === "loading" && "Loading Stockfish..."}
            {engineFailed && "Engine failed — Retry"}
            {engineReady && "New Game"}
            {engineStatus === "idle" && "Loading Stockfish..."}
          </Button>

          <Card className="mt-3 p-4">
            <p className="text-center text-base font-semibold text-text-secondary">{setupSummary}</p>
            <button
              type="button"
              onClick={toggleSettings}
              aria-expanded={showSettings}
              aria-controls="game-settings"
              className="mx-auto mt-2 flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-base font-bold text-text-accent hover:bg-bg-surface-alt"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Change settings
              {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </Card>

          <Button className="mt-3 w-full" variant="secondary" disabled={!engineReady} onClick={onSetup}>
            Set Up a Position
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

            <Field label="Engine strength">
              <div className="grid grid-cols-2 gap-2">
                {SKILL_LEVELS.map((level, i) => (
                  <button
                    key={level.label}
                    type="button"
                    onClick={() => setSkillIndex(i)}
                    aria-pressed={i === skillIndex}
                    className={
                      "min-h-11 rounded-xl border px-2 text-base font-semibold transition-colors " +
                      (i === skillIndex
                        ? "border-transparent bg-bg-primary text-text-on-primary"
                        : "border-border-default bg-bg-surface text-text-primary hover:bg-bg-surface-alt")
                    }
                  >
                    {level.label}
                  </button>
                ))}
              </div>
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

        <section className="mt-5 border-t border-border-default pt-4">
          <button
            type="button"
            onClick={toggleHelp}
            aria-expanded={showHelp}
            aria-controls="how-to-play"
            className="mx-auto flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-bold text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary"
          >
            <BookOpen className="h-4 w-4" />
            How to play
            {showHelp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showHelp && (
            <div id="how-to-play" className="mt-3">
              <HowToPlay />
            </div>
          )}
        </section>

        <p className="mt-auto pt-8 text-center text-sm text-text-muted">build {__GIT_COMMIT__} · {__BUILD_TIME__}</p>
      </main>
    </div>
  );
}
