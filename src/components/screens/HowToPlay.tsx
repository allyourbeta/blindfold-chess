import { Card } from "@/components/ui/Card";

const EXAMPLES: [string, string][] = [
  ["e, 4", "pawn to e4"],
  ["N, f, 3", "knight to f3"],
  ["e, d, 5", "pawn captures on d5 (exd5)"],
  ["O-O", "castle kingside"],
  ["e, 8, then Q", "pawn promotes to queen"],
];

const COMMANDS: [string, string][] = [
  ["Peek", "see the board for 3 seconds — or press Space"],
  ["Hint", "show legal moves"],
  ["History", "past games and stats"],
];

export function HowToPlay() {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-accent">How to play</h3>
      <p className="mb-3 text-base text-text-secondary">
        Tap moves on the keypad: piece, then destination square. Captures and check/checkmate are added
        automatically — never tap them yourself.
      </p>

      <dl className="space-y-1.5 text-base">
        {EXAMPLES.map(([taps, meaning]) => (
          <div key={taps} className="flex gap-3">
            <dt className="w-28 shrink-0 font-mono font-semibold text-text-primary">{taps}</dt>
            <dd className="text-text-secondary">{meaning}</dd>
          </div>
        ))}
      </dl>

      <dl className="mt-4 space-y-1.5 border-t border-border-default pt-4 text-base">
        {COMMANDS.map(([command, meaning]) => (
          <div key={command} className="flex gap-3">
            <dt className="w-16 shrink-0 font-mono font-semibold text-text-primary">{command}</dt>
            <dd className="text-text-secondary">{meaning}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-border-default pt-4 text-base text-text-secondary">
        When more than one piece can reach the same square, a chooser appears — tap the one you mean.
      </p>
    </Card>
  );
}
