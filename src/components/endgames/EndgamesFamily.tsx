import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EndgamesHeader } from "./EndgamesHeader";
import { GoalPill } from "./GoalPill";
import { FAMILY_INFO, type Family, type EndgamePosition } from "@/services/endgames/catalog";
import { groupsForFamily, sideToMove, displayNameFor } from "@/services/endgames/catalogGroups";

interface EndgamesFamilyProps {
  family: Family;
  engineReady: boolean;
  onBack(): void;
  onOpenPosition(entry: EndgamePosition): void;
  onRandom(): void;
}

/** "Rook endings" -> "rook", "Mixed" -> "mixed", for the "Random X ending" button label. */
function familyWord(label: string): string {
  return label.replace(/ endings$/i, "").toLowerCase();
}

export function EndgamesFamily({ family, engineReady, onBack, onOpenPosition, onRandom }: EndgamesFamilyProps) {
  const groups = groupsForFamily(family);
  const total = groups.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6 pb-10">
      <EndgamesHeader title={FAMILY_INFO[family].label} subtitle={`${total} positions`} onBack={onBack} />

      <Button variant="secondary" className="w-full" disabled={!engineReady} onClick={onRandom}>
        Random {familyWord(FAMILY_INFO[family].label)} ending
      </Button>

      {groups.map((group) => (
        <div key={group.key}>
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
                <GoalPill goal={entry.goal} />
              </button>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
