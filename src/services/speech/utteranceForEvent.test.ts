import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import type { GameAudioEvent } from "@/state/gameStore";
import { utteranceForEvent } from "./utteranceForEvent";

type MoveAudioEvent = Extract<GameAudioEvent, { kind: "move" }>;

function moveEvent(by: "player" | "engine"): MoveAudioEvent {
  const chess = new Chess();
  const move = chess.moves({ verbose: true }).find((m) => m.san === "e4")!;
  return { kind: "move", move, by, source: by === "player" ? { kind: "typed" } : null };
}

describe("utteranceForEvent — speech off", () => {
  it("never produces an utterance when speech is off", () => {
    const events: GameAudioEvent[] = [
      moveEvent("engine"),
      moveEvent("player"),
      { kind: "illegal-move", spoken: "Illegal move", source: { kind: "typed" } },
      { kind: "game-end", reason: "stalemate" },
    ];
    for (const event of events) {
      expect(utteranceForEvent(event, "off", "letters")).toBeNull();
    }
  });
});

describe("utteranceForEvent — moves", () => {
  it("speaks the engine's move", () => {
    const utterance = utteranceForEvent(moveEvent("engine"), "on", "letters");
    expect(utterance?.clips).toEqual(["pawn", "e", "4"]);
    expect(utterance?.text).toBe("pawn e 4");
  });

  it("never speaks the player's own move — typed/keypad entries never read back", () => {
    expect(utteranceForEvent(moveEvent("player"), "on", "letters")).toBeNull();
  });
});

describe("utteranceForEvent — illegal moves", () => {
  it("is never spoken, even when speech is on", () => {
    const event: GameAudioEvent = { kind: "illegal-move", spoken: "Illegal move", source: { kind: "typed" } };
    expect(utteranceForEvent(event, "on", "letters")).toBeNull();
  });
});

describe("utteranceForEvent — game end", () => {
  it("speaks a draw reason", () => {
    const event: GameAudioEvent = { kind: "game-end", reason: "stalemate" };
    expect(utteranceForEvent(event, "on", "letters")?.clips).toEqual(["stalemate"]);
  });

  it("has nothing extra to say for checkmate — the mating move's own clip already said it", () => {
    const event: GameAudioEvent = { kind: "game-end", reason: "checkmate" };
    expect(utteranceForEvent(event, "on", "letters")).toBeNull();
  });
});
