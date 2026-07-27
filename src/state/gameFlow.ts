import { Chess, type Move } from "chess.js";
import { resolveMoveInput } from "@/services/chess/moveResolve";
import { detectGameOver, describeGameEnd, formatMovePairs, type GameEndReason } from "@/services/chess/gameSummary";
import { saveGameToHistory } from "@/api/localStore";
import type { EngineManager } from "@/engine/engineManager";
import { useSettingsStore, SKILL_LEVELS } from "./settingsStore";
import type { GameState, MessageType, MoveSource } from "./gameStore";

type SetState = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type GetState = () => GameState;

/**
 * The move-application/engine-request cluster, factored out of gameStore.ts
 * to keep both files under the 300-line cap. Closes over `set`/`get` from
 * the store's `create()` callback plus its own private bookkeeping
 * (message ids, the current game's start time/fen/skill label).
 */
export function createGameFlow(set: SetState, get: GetState, engineManager: EngineManager) {
  let messageIdCounter = 0;
  let gameStartTime = 0;
  let gameStartFen = "";
  let skillLabelAtStart = "";

  function addMessage(type: MessageType, text: string) {
    set((s) => ({ messages: [...s.messages, { id: ++messageIdCounter, type, text }] }));
  }

  function removeThinkingMessage() {
    set((s) => ({ messages: s.messages.filter((m) => m.type !== "thinking") }));
  }

  function requestEngineMove() {
    addMessage("thinking", "Stockfish thinking...");
    set({ isThinking: true });
    engineManager.setLevel(SKILL_LEVELS[useSettingsStore.getState().skillIndex]);
    void engineManager.requestMove(get().chess.fen(), get().moveHistory, applyEngineMove);
  }

  function applyEngineMove(uci: string) {
    const s = get();
    if (s.gameOverFlag || s.chess.turn() === s.playerColor) return; // stale reply — defense in depth
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci[4];
    let result: Move;
    try {
      result = s.chess.move({ from, to, promotion });
    } catch {
      addMessage("error", `Engine returned an invalid move: ${uci}. Restarting the engine.`);
      set({ isThinking: false });
      void engineManager.restart().then(() => {
        const cur = get();
        if (!cur.gameOverFlag && cur.chess.turn() !== cur.playerColor) requestEngineMove();
      });
      return;
    }
    finishMove(result, "engine", null);
  }

  function finishMove(move: Move, by: "player" | "engine", source: MoveSource | null) {
    const playerColor = get().playerColor;
    set((s) => ({
      fen: s.chess.fen(),
      turn: s.chess.turn(),
      lastMove: { from: move.from, to: move.to },
      moveHistory: [...s.moveHistory, move.san],
      isThinking: false,
      audioEvent: { kind: "move", move, by, source },
    }));
    removeThinkingMessage();
    const mover = by === "player" ? playerColor : playerColor === "w" ? "b" : "w";
    addMessage(by, `${mover === "w" ? "White" : "Black"}: ${move.san}`);

    const reason = detectGameOver(get().chess);
    if (reason) {
      finishGame(reason);
      return;
    }
    if (by === "player") requestEngineMove();
  }

  function finishGame(reason: GameEndReason) {
    const s = get();
    const outcome = describeGameEnd(reason, s.chess, s.playerColor);
    set({
      gameOverFlag: true,
      gameOverOutcome: outcome,
      isThinking: false,
      audioEvent: { kind: "game-end", reason },
    });
    removeThinkingMessage();
    addMessage("system", outcome.text);
    saveGameToHistory({
      date: new Date().toISOString(),
      result: outcome.historyResult,
      color: s.playerColor === "w" ? "White" : "Black",
      difficulty: skillLabelAtStart,
      moves: s.moveHistory.length,
      peeks: s.peekCount,
      pgn: formatMovePairs(s.moveHistory),
      fen: gameStartFen,
      durationSec: Math.round((Date.now() - gameStartTime) / 1000),
    });
  }

  async function beginGame(fen: string) {
    if (get().isThinking) await engineManager.restart();

    const chess = new Chess(fen);
    const color = useSettingsStore.getState().playerColor;
    const skill = SKILL_LEVELS[useSettingsStore.getState().skillIndex];
    gameStartTime = Date.now();
    gameStartFen = fen;
    skillLabelAtStart = skill.label;

    set({
      chess,
      fen: chess.fen(),
      turn: chess.turn(),
      playerColor: color,
      moveHistory: [],
      lastMove: null,
      gameOverFlag: false,
      gameOverOutcome: null,
      activeSkillLabel: skill.label,
      isThinking: false,
      peekCount: 0,
      isPeeking: false,
      messages: [],
      audioEvent: null,
    });
    addMessage("system", `Game started. You play ${color === "w" ? "White" : "Black"}. Strength: ${skill.label}`);
    if (chess.turn() !== color) requestEngineMove();
  }

  function attemptMove(raw: string, source: MoveSource = { kind: "typed" }) {
    const s = get();
    if (!s.chess || s.gameOverFlag) return;
    if (s.chess.turn() !== s.playerColor) {
      addMessage("system", "It's not your turn.");
      set({ audioEvent: { kind: "illegal-move", spoken: "Not your turn", attempted: null, source } });
      return;
    }
    const result = resolveMoveInput(s.chess, raw);
    if (!result.ok) {
      if (result.error) addMessage("error", result.error);
      set({ audioEvent: { kind: "illegal-move", spoken: "Illegal move", attempted: raw, source } });
      return;
    }
    finishMove(s.chess.move(result.san), "player", source);
  }

  return { addMessage, beginGame, attemptMove, finishGame };
}
