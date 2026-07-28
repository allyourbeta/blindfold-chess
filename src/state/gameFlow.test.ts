import { describe, it, expect, afterEach } from "vitest";
import { Chess } from "chess.js";
import { STARTING_FEN } from "@/services/chess/fen";
import { createGameFlow } from "./gameFlow";
import { EngineManager } from "@/engine/engineManager";
import { useSettingsStore } from "./settingsStore";
import type { GameState } from "./gameStore";
import type { EngineAdapter } from "@/engine/types";

function fakeAdapter(): EngineAdapter & { resolveNext(uci: string): void } {
  const resolvers: Array<(uci: string) => void> = [];
  return {
    id: "fake",
    init: () => Promise.resolve(),
    isReady: () => true,
    setLevel: () => {},
    requestMove: () =>
      new Promise<string>((resolve) => {
        resolvers.push(resolve);
      }),
    stop: () => {},
    dispose: () => {},
    resolveNext(uci: string) {
      const resolve = resolvers.shift();
      resolve?.(uci);
    },
  };
}

function makeStore() {
  const chess = new Chess();
  let state = {
    chess,
    fen: chess.fen(),
    turn: chess.turn(),
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
  } as unknown as GameState;

  const get = () => state;
  const set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => {
    const p = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...p };
  };
  return { get, set };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Defect 1: a delayed engine reply must not land in a new game", () => {
  afterEach(() => {
    useSettingsStore.getState().setPlayerColor("w");
  });

  it("drops a stale reply held behind the reply floor once a new game has started", async () => {
    useSettingsStore.getState().setPlayerColor("b");

    const adapter = fakeAdapter();
    const engineManager = new EngineManager(adapter);
    await engineManager.load();
    const { get, set } = makeStore();
    const flow = createGameFlow(set, get, engineManager);

    // Game 1, as Black: White (the engine) is to move, so beginGame fires a
    // request immediately.
    await flow.beginGame(STARTING_FEN);

    // The engine "answers" almost immediately (Maia in real life: ~70ms) —
    // well inside the 500-900ms reply floor, so applyEngineMove must hold it
    // behind a setTimeout rather than apply it right away.
    adapter.resolveNext("e2e4");
    await sleep(0);

    // Before that floor elapses, the player starts a fresh game (also Black,
    // so White is to move again — the guard in applyEngineMoveNow passes).
    await flow.beginGame(STARTING_FEN);

    // Let the held setTimeout from game 1's reply fire.
    await sleep(1000);

    expect(get().chess.fen()).toBe(STARTING_FEN);
    expect(get().moveHistory).toEqual([]);
  });
});
