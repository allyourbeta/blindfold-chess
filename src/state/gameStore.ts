import { create } from "zustand";
import { Chess, type Color, type Move } from "chess.js";
import { STARTING_FEN, validateFen } from "@/services/chess/fen";
import {
  formatHint,
  formatHistorySummary,
  formatMovePairs,
  type GameEndReason,
  type GameEndOutcome,
} from "@/services/chess/gameSummary";
import { getGameHistory } from "@/api/localStore";
import { createEngineManager } from "@/engine/createEngineManager";
import type { EngineStatus } from "@/engine/engineManager";
import { createGameFlow } from "./gameFlow";

export type MessageType = "system" | "player" | "engine" | "error" | "thinking";
export interface GameMessage {
  id: number;
  type: MessageType;
  text: string;
}

/** Every player move — typed or via the keypad — is entered as text and never read back. */
export type MoveSource = { kind: "typed" };

export type GameAudioEvent =
  | { kind: "move"; move: Move; by: "player" | "engine"; source: MoveSource | null }
  /**
   * A keypad entry that didn't resolve to a legal move. `attempted` is the
   * SAN-shaped text the player stated (null when there's nothing to name,
   * e.g. "not your turn") — spoken back as "<move>, not legal" so a
   * blindfolded player HEARS the rejection instead of a silent log line.
   */
  | { kind: "illegal-move"; spoken: string; attempted: string | null; source: MoveSource }
  | { kind: "game-end"; reason: GameEndReason };

export interface GameState {
  chess: Chess;
  fen: string;
  turn: Color;
  playerColor: Color;
  moveHistory: string[];
  lastMove: { from: string; to: string } | null;
  gameOverFlag: boolean;
  /** Opponent + randomness stop the current game was started with — shown in the status line. */
  activeOpponentLabel: string;
  gameOverOutcome: GameEndOutcome | null;
  isThinking: boolean;
  engineStatus: EngineStatus;
  peekCount: number;
  isPeeking: boolean;
  messages: GameMessage[];
  setupError: string | null;
  audioEvent: GameAudioEvent | null;

  initEngine(): Promise<void>;
  retryEngine(): Promise<void>;
  startNewGame(): Promise<void>;
  startFromSetup(fen: string): Promise<void>;
  /** Keypad entries only: already-formed SAN, matched exactly against the legal moves. */
  submitKeypadMove(san: string): void;
  doPeek(): void;
  doTakeback(): void;
  doResign(): void;
  requestHint(): void;
  copyPgn(): Promise<void>;
  showFen(): void;
  showHistorySummary(): void;
  returnToMenu(): void;
}

export const useGameStore = create<GameState>((set, get) => {
  let peekTimerId: ReturnType<typeof setTimeout> | null = null;

  const engineManager = createEngineManager({
    onStatusChange: (status) => set({ engineStatus: status }),
  });
  const flow = createGameFlow(set, get, engineManager);

  return {
    chess: new Chess(),
    fen: STARTING_FEN,
    turn: "w",
    playerColor: "w",
    moveHistory: [],
    lastMove: null,
    gameOverFlag: false,
    activeOpponentLabel: "",
    gameOverOutcome: null,
    isThinking: false,
    engineStatus: "idle",
    peekCount: 0,
    isPeeking: false,
    messages: [],
    setupError: null,
    audioEvent: null,

    initEngine: () => engineManager.load(),
    retryEngine: () => engineManager.load(),
    startNewGame: () => flow.beginGame(STARTING_FEN),

    startFromSetup: async (fen: string) => {
      try {
        validateFen(fen);
        set({ setupError: null });
        await flow.beginGame(fen);
      } catch (err) {
        set({ setupError: err instanceof Error ? err.message : "Invalid position." });
      }
    },

    submitKeypadMove: (san: string) => {
      flow.attemptMove(san, { kind: "typed" });
    },

    doPeek: () => {
      const s = get();
      if (!s.chess) return;
      if (peekTimerId) clearTimeout(peekTimerId);
      const wasAlreadyPeeking = s.isPeeking;
      peekTimerId = setTimeout(() => set({ isPeeking: false }), 3000);
      set((cur) => ({ isPeeking: true, peekCount: wasAlreadyPeeking ? cur.peekCount : cur.peekCount + 1 }));
    },

    doTakeback: () => {
      const s = get();
      if (!s.chess || s.gameOverFlag || s.moveHistory.length === 0) return;
      if (s.isThinking) {
        flow.addMessage("system", "Wait for the engine to finish.");
        return;
      }
      // A single ply in history is the engine's own move (this game started
      // with the engine to move) — there is nothing of the player's yet to
      // take back. Undoing it would empty history and strand the game on
      // the engine's turn with no request in flight to get it moving again.
      // Refuse rather than silently discarding the engine's move for a
      // fresh (possibly different) one — the player made no move to redo.
      if (s.moveHistory.length === 1) {
        flow.addMessage("system", "Nothing to take back yet.");
        return;
      }
      let undone = 0;
      while (undone < 2 && s.chess.history().length > 0) {
        const move = s.chess.undo();
        if (!move) break;
        undone++;
        if (s.chess.turn() === s.playerColor) break;
      }
      if (undone > 0) {
        set({ moveHistory: s.chess.history(), fen: s.chess.fen(), turn: s.chess.turn(), lastMove: null });
        flow.addMessage("system", `Took back ${undone} move${undone > 1 ? "s" : ""}.`);
      }
    },

    doResign: () => {
      const s = get();
      if (!s.chess || s.gameOverFlag) return;
      flow.finishGame("resignation");
    },

    requestHint: () => {
      const s = get();
      if (!s.chess || s.gameOverFlag) return;
      if (s.chess.turn() !== s.playerColor) {
        flow.addMessage("system", "Wait for the engine's move.");
        return;
      }
      flow.addMessage("system", formatHint(s.chess));
    },

    copyPgn: async () => {
      const s = get();
      if (!s.moveHistory.length) {
        flow.addMessage("system", "No moves to copy.");
        return;
      }
      const pgn = formatMovePairs(s.moveHistory);
      try {
        await navigator.clipboard.writeText(pgn);
        flow.addMessage("system", "PGN copied to clipboard.");
      } catch {
        flow.addMessage("system", pgn);
      }
    },

    showFen: () => flow.addMessage("system", get().chess.fen()),

    showHistorySummary: () => flow.addMessage("system", formatHistorySummary(getGameHistory())),

    returnToMenu: () => {
      if (get().isThinking) void engineManager.restart();
    },
  };
});
