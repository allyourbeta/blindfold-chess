import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EndgamesHeader } from "./EndgamesHeader";
import { sizeOf, type SizeBucket, type EndgamePosition } from "@/services/endgames/catalog";
import { familiesInBucket, sideToMove, displayNameFor, entriesByBucket } from "@/services/endgames/catalogGroups";

interface EndgamesSizeProps {
  bucket: SizeBucket;
  engineReady: boolean;
  onBack(): void;
  onOpenPosition(entry: EndgamePosition): void;
  onRandom(): void;
}

export function EndgamesSize({ bucket, engineReady, onBack, onOpenPosition, onRandom }: EndgamesSizeProps) {
  const groups = familiesInBucket(bucket);
  const total = entriesByBucket(bucket).length;

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6 pb-10">
      <EndgamesHeader title={bucket.label} subtitle={`${total} positions`} onBack={onBack} />

      <Button variant="secondary" className="w-full" disabled={!engineReady} onClick={onRandom}>
        Random, {bucket.label}
      </Button>

      {groups.map((group) => (
        <div key={group.family}>
          <p className="mb-2 flex items-center justify-between text-sm font-semibold text-text-secondary">
            <span>{group.label}</span>
            <span>{group.entries.length}</span>
          </p>
          <Card>
            {group.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                data-testid="endgame-row"
                onClick={() => onOpenPosition(entry)}
                className="flex min-h-14 w-full items-center gap-3 border-t border-border-default px-4 py-2 text-left first:border-t-0 hover:bg-bg-surface-alt"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold text-text-primary">{displayNameFor(entry)}</div>
                  <div className="mt-0.5 text-sm text-text-secondary">
                    {sideToMove(entry) === "w" ? "White" : "Black"} to move
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-text-muted">{sizeOf(entry.fen)}</span>
              </button>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
