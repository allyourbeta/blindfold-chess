import { Chess, type Move } from "chess.js";
import { detectGameOver, describeGameEnd, formatMovePairs, type GameEndReason } from "@/services/chess/gameSummary";
import { saveGameToHistory } from "@/api/localStore";
import type { EngineManager } from "@/engine/engineManager";
import { RANDOMNESS_STOPS } from "@/engine/maia/policy";
import { useSettingsStore } from "./settingsStore";
import type { GameState, MessageType, MoveSource } from "./gameStore";

/** The model's name, not a strength promise -- see SPEC_maia_integrate.md. */
const OPPONENT_LABEL = "Maia 1900";

function randomnessLabel(): string {
  const stop = useSettingsStore.getState().randomness;
  return RANDOMNESS_STOPS.find((s) => s.value === stop)?.label ?? "Human";
}

type SetState = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type GetState = () => GameState;

/**
 * The move-application/engine-request cluster, factored out of gameStore.ts
 * to keep both files under the 300-line cap. Closes over `set`/`get` from
 * the store's `create()` callback plus its own private bookkeeping
 * (message ids, the current game's start time/fen/skill label).
 */
/**
 * Maia answers in roughly 70ms — faster than a hand leaves the screen, which
 * reads as being rushed rather than as being played against. These bound a
 * minimum time before its reply lands. It's a FLOOR, not an added pause:
 * real thinking time counts towards it, so a slow position never waits
 * twice. Varied rather than fixed, because a person doesn't answer in the
 * same beat every move, and the whole point of Maia is a human-feeling
 * opponent.
 */
const MIN_REPLY_MS = 500;
const MAX_REPLY_MS = 900;

export function createGameFlow(set: SetState, get: GetState, engineManager: EngineManager) {
  let messageIdCounter = 0;
  let replyFloorAt = 0;
  let gameStartTime = 0;
  let gameStartFen = "";
  let opponentLabelAtStart = "";

  function addMessage(type: MessageType, text: string) {
    set((s) => ({ messages: [...s.messages, { id: ++messageIdCounter, type, text }] }));
  }

  function removeThinkingMessage() {
    set((s) => ({ messages: s.messages.filter((m) => m.type !== "thinking") }));
  }

  function requestEngineMove() {
    addMessage("thinking", `${OPPONENT_LABEL} thinking...`);
    set({ isThinking: true });
    replyFloorAt = Date.now() + MIN_REPLY_MS + Math.random() * (MAX_REPLY_MS - MIN_REPLY_MS);
    engineManager.setLevel({ label: OPPONENT_LABEL, randomness: useSettingsStore.getState().randomness });
    void engineManager.requestMove(get().chess.fen(), get().moveHistory, applyEngineMove, (err) =>
      handleEngineFailure(err.message),
    );
  }

  /**
   * The one place a real engine failure surfaces: clears the stuck
   * "thinking" state, tells the player what happened, then attempts a
   * single automatic restart so the game isn't lost. If the restart itself
   * fails, that's the end of automatic recovery — leave a clear message
   * rather than retrying forever.
   */
  function handleEngineFailure(reason: string) {
    set({ isThinking: false });
    removeThinkingMessage();
    addMessage("error", `${reason} Restarting the engine.`);
    void engineManager.restart().then(
      () => {
        const cur = get();
        if (!cur.gameOverFlag && cur.chess.turn() !== cur.playerColor) requestEngineMove();
      },
      () => {
        addMessage("error", "Engine restart failed. Start a new game or reload the app.");
      },
    );
  }

  function applyEngineMove(uci: string) {
    const remaining = replyFloorAt - Date.now();
    if (remaining > 0) {
      // The abort path can't reach a pending timer, so re-check the game
      // state when it fires: resign, New Game or a takeback during the wait
      // must not be followed by the move that was already in flight.
      setTimeout(() => applyEngineMoveNow(uci), remaining);
      return;
    }
    applyEngineMoveNow(uci);
  }

  function applyEngineMoveNow(uci: string) {
    const s = get();
    if (s.gameOverFlag || s.chess.turn() === s.playerColor) return; // stale reply — defense in depth
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci[4];
    let result: Move;
    try {
      result = s.chess.move({ from, to, promotion });
    } catch {
      handleEngineFailure(`Engine returned an invalid move: ${uci}.`);
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
    if (get().gameOverFlag) return; // already recorded — never append history twice
    engineManager.abortSearch(); // no in-flight search may survive into whatever comes next
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
      difficulty: opponentLabelAtStart,
      moves: s.moveHistory.length,
      peeks: s.peekCount,
      pgn: formatMovePairs(s.moveHistory),
      fen: gameStartFen,
      durationSec: Math.round((Date.now() - gameStartTime) / 1000),
    });
  }

  async function beginGame(fen: string) {
    // Unconditional: a prior game's search must never survive into this one,
    // whether it's still running (isThinking) or was already ended (resign,
    // checkmate) — relying on isThinking here was the bug, since finishGame
    // clears it before a caller can ever reach this restart check.
    if (get().isThinking) await engineManager.restart();
    else engineManager.abortSearch();

    const chess = new Chess(fen);
    const color = useSettingsStore.getState().playerColor;
    gameStartTime = Date.now();
    gameStartFen = fen;
    opponentLabelAtStart = `${OPPONENT_LABEL} · ${randomnessLabel()}`;

    set({
      chess,
      fen: chess.fen(),
      turn: chess.turn(),
      playerColor: color,
      moveHistory: [],
      lastMove: null,
      gameOverFlag: false,
      gameOverOutcome: null,
      activeOpponentLabel: opponentLabelAtStart,
      isThinking: false,
      peekCount: 0,
      isPeeking: false,
      messages: [],
      audioEvent: null,
    });
    addMessage(
      "system",
      `Game started. You play ${color === "w" ? "White" : "Black"}. Opponent: ${opponentLabelAtStart}`,
    );

    // A set-up position can already be over (checkmate/stalemate loaded
    // directly) — detect that here, before ever asking the engine for a
    // move it cannot make. Skipping this either leaves the player with a
    // legal-move-less turn and no game-over panel, or asks Stockfish for a
    // move and gets back "(none)" forever.
    const reason = detectGameOver(chess);
    if (reason) {
      finishGame(reason);
      return;
    }
    if (chess.turn() !== color) requestEngineMove();
  }

  /**
   * Every mover (keypad, and submitMoveText's fallback) already produces a
   * well-formed SAN string and has decided its own legality before calling
   * this — matched exactly against chess.js's legal-move list, never
   * reinterpreted or fuzzy-matched. See AUDIT.md §1.1 for why: a resolver
   * that guesses at intent from a bare destination square can silently
   * substitute a different piece's legal move for a rejected one.
   */
  function attemptMove(raw: string, source: MoveSource = { kind: "typed" }) {
    const s = get();
    if (!s.chess || s.gameOverFlag) return;
    if (s.chess.turn() !== s.playerColor) {
      addMessage("system", "It's not your turn.");
      set({ audioEvent: { kind: "illegal-move", spoken: "Not your turn", attempted: null, source } });
      return;
    }
    if (!s.chess.moves().includes(raw)) {
      addMessage("error", `Illegal or unrecognized move: "${raw}". Try again.`);
      set({ audioEvent: { kind: "illegal-move", spoken: "Illegal move", attempted: raw, source } });
      return;
    }
    finishMove(s.chess.move(raw), "player", source);
  }

  return { addMessage, beginGame, attemptMove, finishGame };
}
