import { Sun, Moon, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
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

/** One line under the speech control, so the choice explains itself. */
const SPEECH_HINT = {
  silent: "Nothing is spoken. Moves appear on screen.",
  engine: "The engine's moves are spoken. Yours aren't.",
  both: "The engine's moves are spoken, and your spoken move is read back.",
} as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-2 block text-sm font-semibold text-text-secondary">{label}</span>
      {children}
    </div>
  );
}

export function MenuScreen({ onPlay, onSetup }: MenuScreenProps) {
  const { theme, toggleTheme } = useTheme();
  const playerColor = useSettingsStore((s) => s.playerColor);
  const setPlayerColor = useSettingsStore((s) => s.setPlayerColor);
  const skillIndex = useSettingsStore((s) => s.skillIndex);
  const setSkillIndex = useSettingsStore((s) => s.setSkillIndex);
  const fileNaming = useSettingsStore((s) => s.fileNaming);
  const setFileNaming = useSettingsStore((s) => s.setFileNaming);
  const speechMode = useSettingsStore((s) => s.speechMode);
  const setSpeechMode = useSettingsStore((s) => s.setSpeechMode);

  const engineStatus = useGameStore((s) => s.engineStatus);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const retryEngine = useGameStore((s) => s.retryEngine);

  const engineReady = engineStatus === "ready";
  const engineFailed = engineStatus === "failed";

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

  return (
    <div className="flex h-full w-full flex-col">
      <header className="relative shrink-0 border-b border-border-default px-6 py-5 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-text-accent">Mind's Eye</h1>
        <p className="mt-1 text-sm font-medium tracking-wide text-text-secondary">Chess Visualization Trainer</p>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:bg-bg-surface-alt"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>

      {/* Settings scroll; the actions below stay put. */}
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
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
                  "min-h-11 rounded-xl border px-2 text-sm font-semibold transition-colors " +
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

        <Field label="Spoken moves">
          <SegmentedControl<"silent" | "engine" | "both">
            aria-label="Spoken moves"
            value={speechMode}
            onChange={setSpeechMode}
            options={[
              { value: "silent", label: "Silent" },
              { value: "engine", label: "Engine" },
              { value: "both", label: "Both" },
            ]}
          />
          <p className="mt-2 text-sm text-text-muted">{SPEECH_HINT[speechMode]}</p>
        </Field>

        {speechMode !== "silent" && (
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

        <HowToPlay />
      </div>

      <div className="shrink-0 border-t border-border-default bg-bg-surface px-6 pb-6 pt-4">
        <div className="flex flex-col gap-3">
          <Button variant="primary" disabled={engineStatus === "loading"} onClick={() => void handleStart()}>
            {engineStatus === "loading" && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {engineStatus === "loading" && "Loading Stockfish..."}
            {engineFailed && "Engine failed — Retry"}
            {engineReady && "New Game"}
            {engineStatus === "idle" && "Loading Stockfish..."}
          </Button>
          <Button variant="secondary" disabled={!engineReady} onClick={onSetup}>
            Set Up a Position
          </Button>
        </div>
      </div>
    </div>
  );
}
