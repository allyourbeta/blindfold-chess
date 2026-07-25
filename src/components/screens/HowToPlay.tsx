import { Card } from "@/components/ui/Card";

const EXAMPLES: [string, string][] = [
  ["e4", "pawn to e4"],
  ["Nf3", "knight to f3"],
  ["Bxe5", "bishop captures on e5"],
  ["O-O", "castle kingside"],
  ["e8=Q", "pawn promotes to queen"],
];

const COMMANDS: [string, string][] = [
  ["peek", "see the board for 3 seconds — or press Space"],
  ["hint", "show legal moves"],
  ["history", "past games and stats"],
];

export function HowToPlay() {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-accent">How to play</h3>
      <p className="mb-3 text-base text-text-secondary">Type or speak moves in standard algebraic notation.</p>

      <dl className="space-y-1.5 text-base">
        {EXAMPLES.map(([notation, meaning]) => (
          <div key={notation} className="flex gap-3">
            <dt className="w-16 shrink-0 font-mono font-semibold text-text-primary">{notation}</dt>
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
        Speaking a move? Plain letters work, and so do NATO ones — Alpha, Bravo, Charlie.
      </p>
    </Card>
  );
}
