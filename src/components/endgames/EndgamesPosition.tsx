import { Button } from "@/components/ui/Button";
import { BoardPanel } from "@/components/board/BoardPanel";
import { EndgamesHeader } from "./EndgamesHeader";
import { fenToBoard } from "@/services/chess/fen";
import { pieceList, FAMILY_INFO, materialKey, groupLabel, type EndgamePosition } from "@/services/endgames/catalog";
import { sideToMove, displayNameFor, familyOf } from "@/services/endgames/catalogGroups";

interface EndgamesPositionProps {
  entry: EndgamePosition;
  engineReady: boolean;
  onBack(): void;
  onPlayBlindfold(): void;
  onAnotherFromGroup(): void;
}

export function EndgamesPosition({
  entry,
  engineReady,
  onBack,
  onPlayBlindfold,
  onAnotherFromGroup,
}: EndgamesPositionProps) {
  const side = sideToMove(entry);
  const family = familyOf(entry);
  const key = materialKey(entry.fen);

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6 pb-10">
      <EndgamesHeader title={FAMILY_INFO[family].label} subtitle={groupLabel(key)} onBack={onBack} />

      <BoardPanel board={fenToBoard(entry.fen)} defaultFlipped={side === "b"} />

      <div>
        <p className="text-xl font-extrabold text-text-primary">{displayNameFor(entry)}</p>
        <p className="mt-1 text-base font-bold text-text-accent">
          You play {side === "w" ? "White" : "Black"}. {entry.goal === "win" ? "Win." : "Draw."}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          White: {pieceList(entry.fen, "w")}
          <br />
          Black: {pieceList(entry.fen, "b")}
        </p>
      </div>

      <Button variant="primary" className="w-full" disabled={!engineReady} onClick={onPlayBlindfold}>
        Play Blindfold
      </Button>
      <Button variant="secondary" className="w-full" disabled={!engineReady} onClick={onAnotherFromGroup}>
        Another from this group
      </Button>

      <p className="text-sm text-text-muted">Source: {entry.source.title}.</p>
    </div>
  );
}
