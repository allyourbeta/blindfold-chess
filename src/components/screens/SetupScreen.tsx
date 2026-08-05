import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SetupBoard } from "@/components/board/SetupBoard";
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
}

type CastlingKey = "K" | "Q" | "k" | "q";
const CASTLING_KEYS: CastlingKey[] = ["K", "Q", "k", "q"];
const CASTLING_LABELS: Record<CastlingKey, string> = {
  K: "White O-O",
  Q: "White O-O-O",
  k: "Black O-O",
  q: "Black O-O-O",
};

export function SetupScreen({ onBack, onPlay }: SetupScreenProps) {
  const [board, setBoard] = useState<BoardMatrix>(() => fenToBoard(STARTING_FEN));
  const [selectedPiece, setSelectedPiece] = useState("P");
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [castling, setCastling] = useState<Record<CastlingKey, boolean>>({ K: true, Q: true, k: true, q: true });
  const [enPassant, setEnPassant] = useState("-");
  const [halfmove, setHalfmove] = useState(0);
  const [fullmove, setFullmove] = useState(1);
  const [fenInput, setFenInput] = useState("");
  const [fenError, setFenError] = useState<string | null>(null);

  const playerColor = useSettingsStore((st) => st.playerColor);
  const startFromSetup = useGameStore((s) => s.startFromSetup);
  const setupError = useGameStore((s) => s.setupError);
  const engineReady = useGameStore((s) => s.engineStatus === "ready");

  const castlingString = () => CASTLING_KEYS.filter((k) => castling[k]).join("") || "-";

  function handleSquareClick(row: number, col: number) {
    setBoard((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = next[row][col] ? null : selectedPiece;
      return next;
    });
    setEnPassant("-");
    setHalfmove(0);
    setFullmove(1);
  }

  function handleReset() {
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
    setBoard(Array.from({ length: 8 }, () => Array(8).fill(null)));
    setCastling({ K: false, Q: false, k: false, q: false });
    setEnPassant("-");
    setHalfmove(0);
    setFullmove(1);
  }

  function handleLoadFen() {
    const fen = fenInput.trim();
    if (!fen) return;
    try {
      validateFen(fen);
      const [, fenTurn, fenCastling, fenEp, fenHalf, fenFull] = fen.split(/\s+/);
      setBoard(fenToBoard(fen));
      setTurn(fenTurn === "b" ? "b" : "w");
      setCastling({
        K: fenCastling.includes("K"),
        Q: fenCastling.includes("Q"),
        k: fenCastling.includes("k"),
        q: fenCastling.includes("q"),
      });
      setEnPassant(fenEp || "-");
      setHalfmove(Number.parseInt(fenHalf ?? "0", 10) || 0);
      setFullmove(Number.parseInt(fenFull ?? "1", 10) || 1);
      setFenError(null);
    } catch (err) {
      setFenError(err instanceof Error ? err.message : "Invalid FEN string.");
    }
  }

  async function handlePlay() {
    unlockAudioOutput();
    const fen = boardToFEN(board, turn, castlingString(), enPassant, halfmove, fullmove);
    await startFromSetup(fen);
    if (!useGameStore.getState().setupError) onPlay();
  }

  return (
    <div className="flex h-full w-full flex-col gap-5 overflow-y-auto p-6 pb-10">
      <header className="flex items-center gap-3 border-b border-border-default pb-4 pt-2">
        <button onClick={onBack} aria-label="Back to menu" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-bg-surface-alt">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-text-accent">Position Setup</h1>
          <p className="text-sm text-text-secondary">Click a piece, then click the board. Click again to remove.</p>
        </div>
      </header>

      <SetupBoard
        board={board}
        flipped={playerColor === "b"}
        selectedPiece={selectedPiece}
        onSelectPiece={setSelectedPiece}
        onSquareClick={handleSquareClick}
      />

      <div>
        <span className="mb-2 block text-sm uppercase tracking-wide text-text-secondary">Side to move</span>
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

      <div className="rounded-xl border border-border-default bg-bg-surface-alt p-4">
        <span className="mb-2 block text-sm uppercase tracking-wide text-text-secondary">Castling rights</span>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {CASTLING_KEYS.map((key) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={castling[key]}
                onChange={(e) => setCastling((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="accent-[var(--color-border-active)]"
              />
              {CASTLING_LABELS[key]}
            </label>
          ))}
        </div>
      </div>

      {setupError && <p className="text-sm text-text-error">{setupError}</p>}

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleReset}>
          Reset Standard
        </Button>
        <Button variant="secondary" size="sm" onClick={handleClear}>
          Clear Board
        </Button>
        <Button variant="primary" disabled={!engineReady} onClick={() => void handlePlay()}>
          Play Blindfold
        </Button>
      </div>
    </div>
  );
}
