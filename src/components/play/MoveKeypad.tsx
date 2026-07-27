import { useEffect, useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PieceGlyph } from "@/components/board/PieceGlyph";
import { useGameStore } from "@/state/gameStore";
import { useSpeechStore } from "@/state/speechStore";
import { useSettingsStore } from "@/state/settingsStore";
import { interpretDualTap } from "@/services/keypad/dual";
import {
  computeEntryState,
  PIECE_LETTERS,
  FILE_LETTERS,
  RANK_DIGITS,
  type Tap,
  type LegalMove,
  type PieceLetter,
  type FileLetter,
  type RankDigit,
} from "@/services/keypad/entry";

const PIECE_NAME: Record<PieceLetter, string> = {
  K: "King",
  Q: "Queen",
  R: "Rook",
  B: "Bishop",
  N: "Knight",
  P: "Pawn",
};

/**
 * Novag-style dual keys, straight off the Sapphire II: eight fixed keys,
 * each printed with one file and one rank. Nothing on this keypad ever
 * moves, resizes, or relabels — dimmed vs lit is the only state change.
 */
const DUAL_KEYS = FILE_LETTERS.map((file, i) => ({ file, rank: RANK_DIGITS[i] }));

const PROMOTION_ORDER: { promotion: "q" | "r" | "b" | "n"; label: string }[] = [
  { promotion: "q", label: "Queen" },
  { promotion: "r", label: "Rook" },
  { promotion: "b", label: "Bishop" },
  { promotion: "n", label: "Knight" },
];

export function MoveKeypad() {
  const chess = useGameStore((s) => s.chess);
  const fen = useGameStore((s) => s.fen);
  const turn = useGameStore((s) => s.turn);
  const playerColor = useGameStore((s) => s.playerColor);
  const gameOverFlag = useGameStore((s) => s.gameOverFlag);
  const submitMoveText = useGameStore((s) => s.submitMoveText);
  const isSpeaking = useSpeechStore((s) => s.isSpeaking);
  const assistMode = useSettingsStore((s) => s.assistMode);

  const [taps, setTaps] = useState<Tap[]>([]);
  const isPlayersTurn = turn === playerColor;
  const inert = gameOverFlag || isSpeaking || !isPlayersTurn;

  // A new position (our move, the engine's reply, a takeback) invalidates any in-progress entry.
  useEffect(() => setTaps([]), [fen]);

  const legalMoves = useMemo<LegalMove[]>(() => {
    if (!isPlayersTurn) return [];
    return chess.moves({ verbose: true }).map((m) => ({
      san: m.san,
      piece: m.piece,
      from: m.from,
      to: m.to,
      promotion: m.promotion,
    }));
    // `fen` (not `chess`) is what actually changes on every move — `chess` is mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, isPlayersTurn]);

  const entry = useMemo(() => computeEntryState(legalMoves, taps, assistMode), [legalMoves, taps, assistMode]);

  function play(san: string) {
    submitMoveText(san);
    setTaps([]);
  }

  function pushTap(tap: Tap) {
    if (inert) return;
    const next = computeEntryState(legalMoves, [...taps, tap], assistMode);
    if (next.resolved) play(next.resolved.san);
    // Strict: a fully stated entry that matches nothing goes through the
    // normal submission path so the rejection is spoken, exactly like the
    // voice era's understood-but-illegal response.
    else if (next.invalid) play(next.invalid);
    else setTaps((t) => [...t, tap]);
  }

  function pushPiece(piece: PieceLetter) {
    pushTap({ kind: "piece", value: piece });
  }

  /** A dual key is its file when the entry wants a file, its rank when it wants a rank — the machine decides. */
  /** Novag rule: first tap in a square is the letter, second is the number. Never anything else. */
  function pushDual(file: FileLetter, rank: RankDigit) {
    if (inert) return;
    const reading = interpretDualTap(legalMoves, taps, file, rank, assistMode);
    if (reading === "file") pushTap({ kind: "file", value: file });
    else if (reading === "rank") pushTap({ kind: "rank", value: rank });
  }

  function undoTap() {
    setTaps((t) => t.slice(0, -1));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (inert || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Backspace") {
        event.preventDefault();
        undoTap();
        return;
      }
      // SAN's own case convention: uppercase letters are pieces, lowercase
      // letters are files. This matters for "b", which is both a file and
      // the bishop — lowercase b is ALWAYS the b-file (so 1. b4 is typable),
      // Shift+B is the bishop. The other piece letters aren't files, so
      // their lowercase forms map to pieces as a convenience.
      if (/^[KQRBNP]$/.test(event.key)) {
        const pieceLetter = event.key as PieceLetter;
        if (entry.enabled.pieces[pieceLetter]) pushPiece(pieceLetter);
        return;
      }
      if (/^[a-h]$/.test(event.key)) {
        const file = event.key as FileLetter;
        if (entry.enabled.files[file]) pushTap({ kind: "file", value: file });
        return;
      }
      if (/^[nrqkp]$/.test(event.key)) {
        const pieceLetter = event.key.toUpperCase() as PieceLetter;
        if (entry.enabled.pieces[pieceLetter]) pushPiece(pieceLetter);
        return;
      }
      if (/^[1-8]$/.test(event.key)) {
        const rank = event.key as RankDigit;
        if (entry.enabled.ranks[rank]) pushTap({ kind: "rank", value: rank });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, inert, taps]);

  const chooser = entry.disambiguation;
  const anyChooser = !!chooser || entry.promotionPending;
  const statusText = isSpeaking ? "Engine speaking…" : !isPlayersTurn && !gameOverFlag ? "Engine thinking…" : null;

  return (
    <div role="group" aria-label="Move entry keypad" className="flex flex-col gap-2">
      {/* One slim line for everything transient: entry preview, the SAN /
          promotion choosers, and engine status. Idle = empty. The old
          full-height text-entry row is gone — this is all that remains. */}
      <div className="flex h-8 items-center justify-center overflow-x-auto px-2">
        {chooser ? (
          <div role="group" aria-label="Move chooser" className="flex flex-wrap items-center justify-center gap-2">
            {chooser.map((san) => (
              <Button key={san} type="button" size="sm" onClick={() => play(san)}>
                {san}
              </Button>
            ))}
          </div>
        ) : entry.promotionPending ? (
          <div role="group" aria-label="Move chooser" className="flex flex-wrap items-center justify-center gap-2">
            {PROMOTION_ORDER.map(({ promotion, label }) => {
              const candidate = entry.candidates.find((c) => c.promotion === promotion);
              if (!candidate) return null;
              return (
                <Button key={promotion} type="button" size="sm" onClick={() => play(candidate.san)}>
                  {label}
                </Button>
              );
            })}
          </div>
        ) : statusText ? (
          <span className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            {isSpeaking && <Volume2 className="h-4 w-4" />}
            {statusText}
          </span>
        ) : (
          <span className="font-mono text-lg tracking-wide">{entry.preview}</span>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {PIECE_LETTERS.map((p) => (
          <Button
            key={p}
            type="button"
            size="keypadPiece"
            variant="secondary"
            aria-label={PIECE_NAME[p]}
            className="disabled:!opacity-30"
            disabled={inert || anyChooser || !entry.enabled.pieces[p]}
            onClick={() => pushPiece(p)}
          >
            <PieceGlyph piece={playerColor === "w" ? p : p.toLowerCase()} />
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Button
          type="button"
          variant="secondary"
          className="h-9 disabled:!opacity-30"
          disabled={inert || anyChooser || !entry.enabled.castleKingside}
          onClick={() => pushTap({ kind: "castle", value: "O-O" })}
        >
          O-O
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-9 disabled:!opacity-30"
          disabled={inert || anyChooser || !entry.enabled.castleQueenside}
          onClick={() => pushTap({ kind: "castle", value: "O-O-O" })}
        >
          O-O-O
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-9 text-lg disabled:!opacity-30"
          aria-label="Undo last entry"
          disabled={inert || taps.length === 0}
          onClick={undoTap}
        >
          ⌫
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {DUAL_KEYS.map(({ file, rank }) => (
          <Button
            key={file}
            type="button"
            size="keypadKey"
            variant="secondary"
            aria-label={`${file}${rank}`}
            className="disabled:!opacity-30"
            disabled={inert || anyChooser || !(entry.enabled.files[file] || entry.enabled.ranks[rank])}
            onClick={() => pushDual(file, rank)}
          >
            <span className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{file}</span>
              <span className="text-base text-text-secondary">{rank}</span>
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
