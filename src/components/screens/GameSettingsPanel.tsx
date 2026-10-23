import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useSettingsStore } from "@/state/settingsStore";
import { RANDOMNESS_STOPS } from "@/engine/maia/policy";
import { STOCKFISH_LEVELS } from "@/engine/stockfishLevels";

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

const STOP_BUTTON_CLASS = (selected: boolean) =>
  "min-h-11 rounded-xl px-2 text-base font-semibold transition-colors " +
  (selected ? "raised-on text-text-on-primary" : "raised text-text-primary");

/** The disclosed settings behind the menu's chips -- extracted from MenuScreen to keep both files under the 300-line cap. */
export function GameSettingsPanel() {
  const playerColor = useSettingsStore((s) => s.playerColor);
  const setPlayerColor = useSettingsStore((s) => s.setPlayerColor);
  const opponent = useSettingsStore((s) => s.opponent);
  const setOpponent = useSettingsStore((s) => s.setOpponent);
  const randomness = useSettingsStore((s) => s.randomness);
  const setRandomness = useSettingsStore((s) => s.setRandomness);
  const stockfishLevel = useSettingsStore((s) => s.stockfishLevel);
  const setStockfishLevel = useSettingsStore((s) => s.setStockfishLevel);
  const speechMode = useSettingsStore((s) => s.speechMode);
  const setSpeechMode = useSettingsStore((s) => s.setSpeechMode);
  const assistMode = useSettingsStore((s) => s.assistMode);
  const setAssistMode = useSettingsStore((s) => s.setAssistMode);
  const fileNaming = useSettingsStore((s) => s.fileNaming);
  const setFileNaming = useSettingsStore((s) => s.setFileNaming);

  return (
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

      <Field label="Opponent">
        <SegmentedControl<"maia" | "stockfish">
          aria-label="Opponent"
          value={opponent}
          onChange={setOpponent}
          options={[
            { value: "maia", label: "Maia 1900" },
            { value: "stockfish", label: "Stockfish" },
          ]}
        />
      </Field>

      {opponent === "maia" ? (
        <Field label="Variance">
          <div className="grid grid-cols-2 gap-2">
            {RANDOMNESS_STOPS.map((stop) => (
              <button
                key={stop.value}
                type="button"
                onClick={() => setRandomness(stop.value)}
                aria-pressed={stop.value === randomness}
                className={STOP_BUTTON_CLASS(stop.value === randomness)}
              >
                {stop.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-base text-text-muted">
            {RANDOMNESS_STOPS.find((s) => s.value === randomness)?.hint}
          </p>
        </Field>
      ) : (
        <Field label="Level">
          <div className="grid grid-cols-4 gap-2">
            {STOCKFISH_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setStockfishLevel(level.value)}
                aria-pressed={level.value === stockfishLevel}
                className={STOP_BUTTON_CLASS(level.value === stockfishLevel)}
              >
                {level.label}
              </button>
            ))}
          </div>
        </Field>
      )}

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
  );
}
