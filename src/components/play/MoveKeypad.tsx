import { useEffect, useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useGameStore } from "@/state/gameStore";
import { useSpeechStore } from "@/state/speechStore";
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

const PIECE_GLYPH: Record<PieceLetter, string> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };
const PIECE_NAME: Record<PieceLetter, string> = { K: "King", Q: "Queen", R: "Rook", B: "Bishop", N: "Knight" };
const KEY_TO_PIECE: Record<string, PieceLetter> = { n: "N", b: "B", r: "R", q: "Q", k: "K" };

const PROMOTION_ORDER: { promotion: "q" | "r" | "b" | "n"; label: string }[] = [
  { promotion: "q", label: "Queen" },
  { promotion: "r", label: "Rook" },
  { promotion: "b", label: "Bishop" },
  { promotion: "n", label: "Knight" },
];

/** The move-entry control. Physical piece/file/rank + Backspace keys drive the same state machine as taps. */
export function MoveKeypad() {
  const chess = useGameStore((s) => s.chess);
  const fen = useGameStore((s) => s.fen);
  const turn = useGameStore((s) => s.turn);
  const playerColor = useGameStore((s) => s.playerColor);
  const gameOverFlag = useGameStore((s) => s.gameOverFlag);
  const submitMoveText = useGameStore((s) => s.submitMoveText);
  const isSpeaking = useSpeechStore((s) => s.isSpeaking);

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

  const entry = useMemo(() => computeEntryState(legalMoves, taps), [legalMoves, taps]);

  function play(san: string) {
    submitMoveText(san);
    setTaps([]);
  }

  function pushTap(tap: Tap) {
    if (inert) return;
    const next = computeEntryState(legalMoves, [...taps, tap]);
    if (next.resolved) play(next.resolved.san);
    else setTaps((t) => [...t, tap]);
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
      if (/^[KQRBN]$/.test(event.key)) {
        const pieceLetter = event.key as PieceLetter;
        if (entry.enabled.pieces[pieceLetter]) pushTap({ kind: "piece", value: pieceLetter });
        return;
      }
      if (/^[a-h]$/.test(event.key)) {
        const file = event.key as FileLetter;
        if (entry.enabled.files[file]) pushTap({ kind: "file", value: file });
        return;
      }
      const pieceLetter = KEY_TO_PIECE[event.key];
      if (pieceLetter) {
        if (entry.enabled.pieces[pieceLetter]) pushTap({ kind: "piece", value: pieceLetter });
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

  const statusText = isSpeaking ? "Engine speaking…" : !isPlayersTurn && !gameOverFlag ? "Engine thinking…" : null;

  return (
    <div role="group" aria-label="Move entry keypad" className="flex flex-col gap-2">
      <div className="flex h-11 items-center justify-center overflow-x-auto rounded-xl border border-border-default bg-bg-surface-alt px-3">
        {entry.disambiguation ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {entry.disambiguation.map((san) => (
              <Button key={san} type="button" size="sm" onClick={() => play(san)}>
                {san}
              </Button>
            ))}
          </div>
        ) : entry.promotionPending ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
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
          <span className={cn("font-mono text-lg tracking-wide", taps.length === 0 && "text-text-muted")}>
            {entry.preview || "Tap a piece or a file to begin"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {PIECE_LETTERS.map((p) => (
          <Button
            key={p}
            type="button"
            size="keypadPiece"
            variant="secondary"
            aria-label={PIECE_NAME[p]}
            disabled={inert || !entry.enabled.pieces[p]}
            onClick={() => pushTap({ kind: "piece", value: p })}
          >
            {PIECE_GLYPH[p]}
          </Button>
        ))}
      </div>

      {(entry.enabled.castleKingside || entry.enabled.castleQueenside) && (
        <div className="grid grid-cols-2 gap-2">
          {entry.enabled.castleKingside && (
            <Button type="button" variant="secondary" disabled={inert} onClick={() => pushTap({ kind: "castle", value: "O-O" })}>
              O-O
            </Button>
          )}
          {entry.enabled.castleQueenside && (
            <Button
              type="button"
              variant="secondary"
              disabled={inert}
              onClick={() => pushTap({ kind: "castle", value: "O-O-O" })}
            >
              O-O-O
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-1.5">
        {FILE_LETTERS.map((f) => (
          <Button
            key={f}
            type="button"
            size="keypadKey"
            variant="secondary"
            className="flex-1"
            disabled={inert || !entry.enabled.files[f]}
            onClick={() => pushTap({ kind: "file", value: f })}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="flex gap-1.5">
        {RANK_DIGITS.map((r) => (
          <Button
            key={r}
            type="button"
            size="keypadKey"
            variant="secondary"
            className="flex-1"
            disabled={inert || !entry.enabled.ranks[r]}
            onClick={() => pushTap({ kind: "rank", value: r })}
          >
            {r}
          </Button>
        ))}
        <Button
          type="button"
          size="keypadKey"
          variant="secondary"
          className="w-12 shrink-0"
          aria-label="Undo last entry"
          disabled={inert || taps.length === 0}
          onClick={undoTap}
        >
          ⌫
        </Button>
      </div>
    </div>
  );
}
