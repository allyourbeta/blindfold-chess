import { useEffect, useState } from "react";
import { ArrowDownUp, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SetupBoard } from "@/components/board/SetupBoard";
import { PieceGlyph } from "@/components/board/PieceGlyph";
import { cn } from "@/lib/cn";
import {
  fenToBoard,
  boardToFEN,
  validateFen,
  STARTING_FEN,
  type SetupBoard as BoardMatrix,
} from "@/services/chess/fen";
import { useGameStore } from "@/state/gameStore";
import { useSettingsStore } from "@/state/settingsStore";
import { unlockAudioOutput } from "@/hooks/useSpeechOutput";

interface SetupScreenProps {
  onBack(): void;
  onPlay(): void;
  /** Preloads the setup state from this FEN (e.g. returning via "Edit position") instead of the standard start. The FEN text box itself stays empty. */
  initialFen?: string | null;
}

type CastlingKey = "K" | "Q" | "k" | "q";
const CASTLING_KEYS: CastlingKey[] = ["K", "Q", "k", "q"];
const CASTLING_LABELS: Record<CastlingKey, string> = {
  K: "White O-O",
  Q: "White O-O-O",
  k: "Black O-O",
  q: "Black O-O-O",
};

interface ParsedSetup {
  board: BoardMatrix;
  turn: "w" | "b";
  castling: Record<CastlingKey, boolean>;
  enPassant: string;
  halfmove: number;
  fullmove: number;
}

/** The one FEN parser for this screen -- used both for "Load" and for preloading from a prior set-up game's position. */
function applyFen(fen: string): ParsedSetup {
  const [, fenTurn, fenCastling, fenEp, fenHalf, fenFull] = fen.split(/\s+/);
  return {
    board: fenToBoard(fen),
    turn: fenTurn === "b" ? "b" : "w",
    castling: {
      K: fenCastling.includes("K"),
      Q: fenCastling.includes("Q"),
      k: fenCastling.includes("k"),
      q: fenCastling.includes("q"),
    },
    enPassant: fenEp || "-",
    halfmove: Number.parseInt(fenHalf ?? "0", 10) || 0,
    fullmove: Number.parseInt(fenFull ?? "1", 10) || 1,
  };
}

export function SetupScreen({ onBack, onPlay, initialFen }: SetupScreenProps) {
  const [initialSetup] = useState<ParsedSetup | null>(() => (initialFen ? applyFen(initialFen) : null));
  const [board, setBoard] = useState<BoardMatrix>(() => initialSetup?.board ?? fenToBoard(STARTING_FEN));
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [turn, setTurn] = useState<"w" | "b">(() => initialSetup?.turn ?? "w");
  const [castling, setCastling] = useState<Record<CastlingKey, boolean>>(
    () => initialSetup?.castling ?? { K: true, Q: true, k: true, q: true },
  );
  const [enPassant, setEnPassant] = useState(() => initialSetup?.enPassant ?? "-");
  const [halfmove, setHalfmove] = useState(() => initialSetup?.halfmove ?? 0);
  const [fullmove, setFullmove] = useState(() => initialSetup?.fullmove ?? 1);
  const [fenInput, setFenInput] = useState("");
  const [fenError, setFenError] = useState<string | null>(null);

  const playerColor = useSettingsStore((st) => st.playerColor);
  const toggleBoardFlip = useSettingsStore((st) => st.toggleBoardFlip);
  const resetBoardFlip = useSettingsStore((st) => st.resetBoardFlip);

  // Flips are local (decision 7): Position Setup always opens unflipped from
  // the player's own side, even if the last position or game was flipped.
  useEffect(() => {
    resetBoardFlip();
  }, [resetBoardFlip]);
  const startFromSetup = useGameStore((s) => s.startFromSetup);
  const clearSetupError = useGameStore((s) => s.clearSetupError);
  const setupError = useGameStore((s) => s.setupError);
  const engineStatus = useGameStore((s) => s.engineStatus);
  // Tappable once failed too, not just once ready -- otherwise the error
  // line's own "Tap Play Blindfold to try again" would name a disabled
  // button, with no other way back to a working engine from this screen.
  const canStart = engineStatus === "ready" || engineStatus === "failed";

  const castlingString = () => CASTLING_KEYS.filter((k) => castling[k]).join("") || "-";

  function handleSquareClick(row: number, col: number) {
    clearSetupError();
    setBoard((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = selectedPiece === null ? null : next[row][col] === selectedPiece ? null : selectedPiece;
      return next;
    });
    setEnPassant("-");
    setHalfmove(0);
    setFullmove(1);
  }

  function handleReset() {
    clearSetupError();
    setBoard(fenToBoard(STARTING_FEN));
    setTurn("w");
    setCastling({ K: true, Q: true, k: true, q: true });
    setEnPassant("-");
    setHalfmove(0);
    setFullmove(1);
    setFenInput("");
    setFenError(null);
  }

  function handleClear() {
    clearSetupError();
    setBoard(Array.from({ length: 8 }, () => Array(8).fill(null)));
    setCastling({ K: false, Q: false, k: false, q: false });
    setEnPassant("-");
    setHalfmove(0);
    setFullmove(1);
  }

  function handleLoadFen() {
    clearSetupError();
    const fen = fenInput.trim();
    if (!fen) return;
    try {
      validateFen(fen);
      const parsed = applyFen(fen);
      setBoard(parsed.board);
      setTurn(parsed.turn);
      setCastling(parsed.castling);
      setEnPassant(parsed.enPassant);
      setHalfmove(parsed.halfmove);
      setFullmove(parsed.fullmove);
      setFenError(null);
    } catch (err) {
      setFenError(err instanceof Error ? err.message : "Invalid FEN string.");
    }
  }

  async function handlePlay() {
    unlockAudioOutput();
    const fen = boardToFEN(board, turn, castlingString(), enPassant, halfmove, fullmove);
    const ok = await startFromSetup(fen);
    if (ok) onPlay();
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto px-6 pt-[max(1rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(2.5rem,env(safe-area-inset-bottom))] [&>*]:shrink-0">
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border-default pb-1.5">
        <button
          onClick={onBack}
          aria-label="Back to menu"
          className="raised flex h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          Menu
        </button>
        {/* SPEC_full_app_audit.md: at a narrow phone width this title hard-clipped with no ellipsis -- EndgamesHeader.tsx already carries the same `max-[380px]:text-lg` step-down for this exact shape, so this title gets it too rather than a one-off fix. */}
        <h1 className="min-w-0 overflow-hidden text-center text-xl font-extrabold whitespace-nowrap text-text-accent max-[380px]:text-lg">
          Position Setup
        </h1>
        <span
          aria-hidden="true"
          className="invisible flex h-11 items-center gap-1 rounded-full px-3 text-sm font-bold"
        >
          <ChevronLeft className="h-4 w-4" />
          Menu
        </span>
      </header>

      <SetupBoard
        board={board}
        flipped={playerColor === "b"}
        selectedPiece={selectedPiece}
        onSelectPiece={setSelectedPiece}
        onSquareClick={handleSquareClick}
      />

      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">To move</span>
        <div className="flex-1">
          <SegmentedControl<"w" | "b">
            aria-label="Side to move"
            value={turn}
            onChange={setTurn}
            options={[
              { value: "w", label: "White" },
              { value: "b", label: "Black" },
            ]}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Rotate the board 180 degrees"
          onClick={() => toggleBoardFlip(playerColor === "b")}
        >
          <ArrowDownUp className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
          Reset
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={handleClear}>
          Clear
        </Button>
        <Button type="button" variant="primary" disabled={!canStart} onClick={() => void handlePlay()} className="flex-1">
          Play Blindfold
        </Button>
      </div>

      {setupError && <p className="text-sm text-text-error">{setupError}</p>}

      <div className="grid grid-cols-4 gap-1.5">
        {CASTLING_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={castling[key]}
            aria-label={CASTLING_LABELS[key]}
            onClick={() => setCastling((prev) => ({ ...prev, [key]: !prev[key] }))}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-focus)] focus-visible:ring-offset-2",
              castling[key] ? "raised-on text-text-on-primary" : "raised text-text-primary",
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center">
              <PieceGlyph piece={key === "K" || key === "Q" ? "K" : "k"} />
            </span>
            {key === "K" || key === "k" ? "O-O" : "O-O-O"}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
          placeholder="Paste FEN string..."
          className="min-h-11 flex-1 rounded-xl border border-border-default bg-bg-surface px-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-border-active focus:outline-none"
        />
        <Button variant="secondary" size="sm" onClick={handleLoadFen}>
          Load
        </Button>
      </div>
      {fenError && <p className="-mt-3 text-sm text-text-error">{fenError}</p>}
    </div>
  );
}
