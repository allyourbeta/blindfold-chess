import { useState } from "react";
import { ChevronRight, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EndgamesHeader } from "./EndgamesHeader";
import { EndgameCard } from "./EndgameCard";
import { SIZE_BUCKETS, search as searchCatalog, bucketOf, type SizeBucket, type EndgamePosition } from "@/services/endgames/catalog";
import { countsByBucket, favoriteEntries } from "@/services/endgames/catalogGroups";
import { useFavorites } from "@/state/favoritesStore";

interface EndgamesHomeProps {
  engineReady: boolean;
  onBack(): void;
  onOpenSize(bucket: SizeBucket): void;
  onOpenPosition(entry: EndgamePosition): void;
  onOpenFavorites(): void;
  onRandom(): void;
}

export function EndgamesHome({
  engineReady,
  onBack,
  onOpenSize,
  onOpenPosition,
  onOpenFavorites,
  onRandom,
}: EndgamesHomeProps) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const results = trimmed ? searchCatalog(trimmed) : null;
  const counts = countsByBucket();
  const favoriteCodes = useFavorites((s) => s.codes);
  const favoriteCount = favoriteEntries(favoriteCodes).length;

  return (
    <div
      data-testid="endgame-scroll"
      className="flex h-full w-full flex-col gap-4 overflow-y-auto px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
    >
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
        <Card>
          <button
            type="button"
            data-testid="favorites-row"
            onClick={onOpenFavorites}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-bg-surface-alt"
          >
            <Star className="h-5 w-5 shrink-0 text-text-accent" fill="currentColor" />
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold text-text-primary">Favorites</div>
              <div className="mt-0.5 text-sm text-text-secondary">Positions you starred</div>
            </div>
            <span className="shrink-0 text-sm font-bold text-text-muted">{favoriteCount}</span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-text-muted" />
          </button>
        </Card>
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
          {SIZE_BUCKETS.map((bucket) => {
            const inBucket = results.filter((entry) => bucketOf(entry.fen)?.label === bucket.label);
            if (inBucket.length === 0) return null;
            return (
              <div key={bucket.label}>
                <p
                  data-testid="search-size-heading"
                  className="mb-2 border-t border-border-default pt-1.5 text-sm font-extrabold text-text-primary"
                >
                  {bucket.label}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {inBucket.map((entry) => (
                    <EndgameCard key={entry.id} entry={entry} onClick={() => onOpenPosition(entry)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
