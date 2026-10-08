import { EndgamesHeader } from "./EndgamesHeader";
import { EndgameCard } from "./EndgameCard";
import { DiceButton } from "./DiceButton";
import { type SizeBucket, type EndgamePosition } from "@/services/endgames/catalog";
import { familiesInBucket, entriesByBucket } from "@/services/endgames/catalogGroups";

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
    <div
      data-testid="endgame-scroll"
      className="flex h-full w-full flex-col gap-4 overflow-y-auto px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
    >
      <EndgamesHeader
        title={bucket.label}
        subtitle={`${total} positions`}
        onBack={onBack}
        right={<DiceButton ariaLabel={`Random, ${bucket.label}`} disabled={!engineReady} onClick={onRandom} />}
      />

      {groups.map((group) => (
        <div key={group.family}>
          <p className="mb-2 flex items-center justify-between text-sm font-semibold text-text-secondary">
            <span>{group.label}</span>
            <span>{group.entries.length}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {group.entries.map((entry) => (
              <EndgameCard key={entry.id} entry={entry} onClick={() => onOpenPosition(entry)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
