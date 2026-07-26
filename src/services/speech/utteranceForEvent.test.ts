import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import type { GameAudioEvent } from "@/state/gameStore";
import { utteranceForEvent } from "./utteranceForEvent";

type MoveAudioEvent = Extract<GameAudioEvent, { kind: "move" }>;

function moveEvent(san: "e4" | "exd5"): MoveAudioEvent {
  const chess = new Chess();
  if (san === "e4") {
    const move = chess.moves({ verbose: true }).find((m) => m.san === "e4")!;
    return { kind: "move", move, by: "player", source: { kind: "voice", confidence: 1 } };
  }
  chess.load("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
  const move = chess.moves({ verbose: true }).find((m) => m.san === "exd5")!;
  return { kind: "move", move, by: "player", source: { kind: "voice", confidence: 1 } };
}

const MOVE = moveEvent("e4");
const EVENTS: GameAudioEvent[] = [
  MOVE,
  moveEvent("exd5"),
  { kind: "illegal-move", spoken: "Illegal move", source: { kind: "voice", confidence: 1 } },
  { kind: "rejected-move", piece: "n", to: "e5", reason: "illegal", source: { kind: "voice", confidence: 1 } },
  { kind: "not-understood", heard: "garbled" },
  { kind: "game-end", reason: "stalemate" },
];

describe("utteranceForEvent — no generated tones", () => {
  for (const mode of ["silent", "engine", "both"] as const) {
    it(`never includes a tone field in ${mode} mode`, () => {
      for (const event of EVENTS) {
        const { utterance } = utteranceForEvent(event, mode, "letters", false);
        expect("tone" in (utterance ?? {})).toBe(false);
      }
    });
  }
});

describe("utteranceForEvent — voice rules", () => {
  it("speaks a player's voice move in both mode", () => {
    expect(utteranceForEvent(MOVE, "both", "letters", false).utterance?.clips).toEqual(["pawn", "e", "4"]);
  });

  it("does not speak a player's move in engine mode", () => {
    expect(utteranceForEvent(MOVE, "engine", "letters", false).utterance).toBeNull();
  });

  it("speaks an engine move in engine mode", () => {
    const engineMove: GameAudioEvent = { ...MOVE, by: "engine", source: null };
    expect(utteranceForEvent(engineMove, "engine", "letters", false).utterance?.clips).toEqual(["pawn", "e", "4"]);
  });

  it("suppresses a repeated not-understood sentence", () => {
    const event: GameAudioEvent = { kind: "not-understood", heard: "garbled" };
    expect(utteranceForEvent(event, "both", "letters", true).utterance).toBeNull();
  });
});
