import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EndgamesHeader } from "./EndgamesHeader";
import {
  SIZE_BUCKETS,
  search as searchCatalog,
  sizeOf,
  type SizeBucket,
  type EndgamePosition,
} from "@/services/endgames/catalog";
import { countsByBucket, sideToMove, displayNameFor, bucketOfEntry } from "@/services/endgames/catalogGroups";

interface EndgamesHomeProps {
  engineReady: boolean;
  onBack(): void;
  onOpenSize(bucket: SizeBucket): void;
  onOpenPosition(entry: EndgamePosition): void;
  onRandom(): void;
}

export function EndgamesHome({ engineReady, onBack, onOpenSize, onOpenPosition, onRandom }: EndgamesHomeProps) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const results = trimmed ? searchCatalog(trimmed) : null;
  const counts = countsByBucket();

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6 pb-10">
      <EndgamesHeader title="Endgames" subtitle="Pick a size, or search." onBack={onBack} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search: rook, Lucena, opposite bishops…"
          aria-label="Search endgames"
          className="min-h-11 w-full rounded-xl border border-border-default bg-bg-surface py-0 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-border-active focus:outline-none"
        />
      </div>

      {results === null && (
        <Button variant="secondary" className="w-full" disabled={!engineReady} onClick={onRandom}>
          Random endgame
        </Button>
      )}

      {results === null && (
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">By size</p>
          <Card>
            {SIZE_BUCKETS.map((bucket) => (
              <button
                key={bucket.label}
                type="button"
                data-testid="size-row"
                onClick={() => onOpenSize(bucket)}
                className="flex min-h-14 w-full items-center gap-3 border-t border-border-default px-4 py-2 text-left first:border-t-0 hover:bg-bg-surface-alt"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold text-text-primary">{bucket.label}</div>
                  <div className="mt-0.5 text-sm text-text-secondary">{bucket.subtitle}</div>
                </div>
                <span className="shrink-0 text-sm font-bold text-text-muted">{counts[bucket.label]}</span>
                <ChevronRight className="h-[18px] w-[18px] shrink-0 text-text-muted" />
              </button>
            ))}
          </Card>
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="text-center text-base text-text-secondary">No endgames match &quot;{trimmed}&quot;.</p>
          <Button variant="secondary" className="w-full" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-text-secondary">
            {results.length} match{results.length === 1 ? "" : "es"}
          </p>
          <Card>
            {results.map((entry) => {
              const side = sideToMove(entry);
              return (
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
                      {bucketOfEntry(entry).label}. {side === "w" ? "White" : "Black"} to move
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-text-muted">{sizeOf(entry.fen)}</span>
                </button>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}
