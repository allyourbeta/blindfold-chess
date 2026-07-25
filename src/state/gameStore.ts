import { create } from "zustand";
import { Chess, type Color, type Move, type PieceSymbol } from "chess.js";
import { STARTING_FEN, validateFen } from "@/services/chess/fen";
import { parseTypedCommand } from "@/services/chess/commands";
import {
  formatHint,
  formatHistorySummary,
  formatMovePairs,
  type GameEndReason,
  type GameEndOutcome,
} from "@/services/chess/gameSummary";
import type { TranscriptMatch } from "@/services/speech/match";
import { getGameHistory } from "@/api/localStore";
import { createEngineManager } from "@/engine/createEngineManager";
import type { EngineStatus } from "@/engine/engineManager";
import { useSpeechStore } from "./speechStore";
import { createGameFlow } from "./gameFlow";

export type MessageType = "system" | "player" | "engine" | "error" | "voice" | "thinking";
export interface GameMessage {
  id: number;
  type: MessageType;
  text: string;
}

/**
 * Where a player move came from. Voice moves carry the matcher's confidence
 * so the readback setting can stay quiet on a clean match and speak up on a
 * shaky one; typed moves need no readback at all.
 */
export type MoveSource = { kind: "typed" } | { kind: "voice"; confidence: number };

export type GameAudioEvent =
  | { kind: "move"; move: Move; by: "player" | "engine"; source: MoveSource | null }
  | { kind: "illegal-move"; spoken: string; source: MoveSource }
  /** A voice move that was understood but can't be played. Spoken from clips. */
  | { kind: "rejected-move"; piece: PieceSymbol; to: string; reason: "illegal" | "ambiguous"; source: MoveSource }
  /** Speech was heard but matched nothing — not a command, not a move shape. */
  | { kind: "not-understood"; heard: string }
  | { kind: "game-end"; reason: GameEndReason };

export interface GameState {
  chess: Chess;
  fen: string;
  turn: Color;
  playerColor: Color;
  moveHistory: string[];
  lastMove: { from: string; to: string } | null;
  gameOverFlag: boolean;
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
  submitMoveText(raw: string): void;
  submitVoiceMatch(match: TranscriptMatch): void;
  doPeek(): void;
  doTakeback(): void;
  doResign(): void;
  requestHint(): void;
  copyPgn(): Promise<void>;
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

    submitMoveText: (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const s = get();
      switch (parseTypedCommand(trimmed)) {
        case "peek":
          s.doPeek();
          return;
        case "resign":
          s.doResign();
          return;
        case "takeback":
          s.doTakeback();
          return;
        case "hint":
          s.requestHint();
          return;
        case "fen":
          flow.addMessage("system", s.chess.fen());
          return;
        case "pgn":
          void s.copyPgn();
          return;
        case "history":
          s.showHistorySummary();
          return;
        default:
          flow.attemptMove(trimmed, { kind: "typed" });
      }
    },

    submitVoiceMatch: (match: TranscriptMatch) => {
      const s = get();
      if (match.type === "none") {
        // Silence here is indistinguishable from success, so say so out loud.
        // Only when something was actually heard — empty transcripts are the
        // recognizer misfiring, and announcing those would be constant noise.
        useSpeechStore.getState().setLastHeard(match.heard, null);
        if (match.heard) {
          flow.addMessage("error", `Didn't understand: "${match.heard}"`);
          set({ audioEvent: { kind: "not-understood", heard: match.heard } });
        }
        return;
      }
      if (match.type === "command") {
        useSpeechStore.getState().setLastHeard(match.command, match.command);
        if (match.command === "peek") s.doPeek();
        else if (match.command === "resign") s.doResign();
        else if (match.command === "takeback") s.doTakeback();
        else if (match.command === "hint") s.requestHint();
        else if (match.command === "new-game") void s.startNewGame();
        return;
      }
      if (match.type === "rejected") {
        // Understood, but not playable. Say so and play nothing — the board is
        // hidden, so silently substituting a legal move is the worst option.
        const spoken =
          match.reason === "ambiguous"
            ? `${match.label} is ambiguous. Say which one.`
            : `${match.label} is not legal.`;
        useSpeechStore.getState().setLastHeard(match.label, null);
        flow.addMessage("error", spoken);
        set({
          audioEvent: {
            kind: "rejected-move",
            piece: match.piece,
            to: match.to,
            reason: match.reason,
            source: { kind: "voice", confidence: match.confidence },
          },
        });
        return;
      }
      useSpeechStore.getState().setLastHeard(match.move.san, match.move.san);
      flow.attemptMove(match.move.san, { kind: "voice", confidence: match.confidence });
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

    showHistorySummary: () => flow.addMessage("system", formatHistorySummary(getGameHistory())),

    returnToMenu: () => {
      useSpeechStore.getState().setListening(false);
      if (get().isThinking) void engineManager.restart();
    },
  };
});
