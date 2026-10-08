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

/** An adapter whose init() and requestMove() stay pending until the test resolves/rejects them explicitly, with init() calls kept by index rather than FIFO so an out-of-order resolution (the second restart finishing before the first) is expressible. */
function controllableAdapter(): EngineAdapter & {
  resolveInit(index: number): void;
  rejectInit(index: number, err: Error): void;
  resolveNext(uci: string): void;
  rejectNext(err: Error): void;
  moveRequestCount: number;
} {
  const initCalls: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  const moveResolvers: Array<{ resolve: (uci: string) => void; reject: (err: Error) => void }> = [];
  const adapter = {
    id: "fake",
    init: () =>
      new Promise<void>((resolve, reject) => {
        initCalls.push({ resolve, reject });
      }),
    isReady: () => true,
    setLevel: () => {},
    moveRequestCount: 0,
    requestMove: () => {
      adapter.moveRequestCount++;
      return new Promise<string>((resolve, reject) => {
        moveResolvers.push({ resolve, reject });
      });
    },
    stop: () => {},
    dispose: () => {},
    resolveInit(index: number) {
      initCalls[index]?.resolve();
    },
    rejectInit(index: number, err: Error) {
      initCalls[index]?.reject(err);
    },
    resolveNext(uci: string) {
      moveResolvers.shift()?.resolve(uci);
    },
    rejectNext(err: Error) {
      moveResolvers.shift()?.reject(err);
    },
  };
  return adapter;
}

describe("Decision: one gameSession at a time (SPEC_lifecycle.md Part 2)", () => {
  afterEach(() => {
    useSettingsStore.getState().setPlayerColor("w");
  });

  it("a second beginGame overlapping the first's restart installs only the second game, with exactly one move request", async () => {
    const adapter = controllableAdapter();
    const engineManager = new EngineManager(adapter);
    const initialLoad = engineManager.load();
    adapter.resolveInit(0);
    await initialLoad;

    const { get, set } = makeStore();
    set({ isThinking: true }); // a previous search is still in flight
    const flow = createGameFlow(set, get, engineManager);
    // King and a pawn vs. a bare king -- White to move, not already over (unlike
    // a bare-kings position, which chess.js calls an immediate insufficient-material draw).
    const secondGameFen = "4k3/8/8/8/8/8/P7/4K3 w - - 0 1";

    const first = flow.beginGame(STARTING_FEN, { playerColor: "b" }); // sees isThinking -> awaits restart (init call #1)
    await sleep(0);
    const second = flow.beginGame(secondGameFen, { playerColor: "b" }); // also sees isThinking still true -> awaits restart (init call #2)
    await sleep(0);

    // The second call's restart resolves first...
    adapter.resolveInit(2);
    await sleep(0);
    // ...and only then does the first (now-stale) call's restart resolve.
    adapter.resolveInit(1);

    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(get().fen).toBe(secondGameFen);
    expect(get().moveHistory).toEqual([]);
    expect(adapter.moveRequestCount).toBe(1); // only the winning (second) game ever asked the engine to move
  });

  it("beginGame returns false and sets engineStatus failed when the restart rejects, without touching the running game", async () => {
    const adapter = controllableAdapter();
    const engineManager = new EngineManager(adapter);
    const initialLoad = engineManager.load();
    adapter.resolveInit(0);
    await initialLoad;

    const { get, set } = makeStore();
    set({ isThinking: true, fen: "PREVIOUS_GAME_MARKER", moveHistory: ["e4"] });
    const flow = createGameFlow(set, get, engineManager);

    const result = flow.beginGame(STARTING_FEN);
    await sleep(0);
    adapter.rejectInit(1, new Error("boom"));

    expect(await result).toBe(false);
    expect(get().engineStatus).toBe("failed");
    // The previous game's state must be exactly as it was -- no half-install.
    expect(get().fen).toBe("PREVIOUS_GAME_MARKER");
    expect(get().moveHistory).toEqual(["e4"]);
  });

  it("a new game started before an engine-failure recovery resolves gets no extra move request from that stale recovery", async () => {
    const adapter = controllableAdapter();
    const engineManager = new EngineManager(adapter);
    const initialLoad = engineManager.load();
    adapter.resolveInit(0);
    await initialLoad;

    useSettingsStore.getState().setPlayerColor("b"); // the engine (White) is always the one asked to move below
    const { get, set } = makeStore();
    const flow = createGameFlow(set, get, engineManager);

    await flow.beginGame(STARTING_FEN); // isThinking was false -> no restart, moves straight to requesting a move
    expect(adapter.moveRequestCount).toBe(1);

    adapter.rejectNext(new Error("worker died")); // the in-flight request fails -> handleEngineFailure
    await sleep(0); // handleEngineFailure runs, kicks off its own restart (init call #1)

    const second = flow.beginGame(STARTING_FEN); // a fresh game, started before that recovery resolves
    expect(await second).toBe(true);
    expect(adapter.moveRequestCount).toBe(2); // the new game's own move request

    adapter.resolveInit(1); // the stale recovery finally resolves
    await sleep(0);

    expect(adapter.moveRequestCount).toBe(2); // unchanged -- the stale recovery asked for no move
  });
});

describe("beginGame: an explicit playerColor overrides the settings colour, without writing it", () => {
  afterEach(() => {
    useSettingsStore.getState().setPlayerColor("w");
  });

  it("uses opts.playerColor instead of the settings colour, and leaves settings unchanged", async () => {
    useSettingsStore.getState().setPlayerColor("w");

    const adapter = fakeAdapter();
    const engineManager = new EngineManager(adapter);
    await engineManager.load();
    const { get, set } = makeStore();
    const flow = createGameFlow(set, get, engineManager);

    // White to move, but forced to play Black -- the engine (White) must be
    // asked to move immediately, same as a normal game started as Black.
    await flow.beginGame(STARTING_FEN, { playerColor: "b" });

    expect(get().playerColor).toBe("b");
    expect(useSettingsStore.getState().playerColor).toBe("w");
  });
});
