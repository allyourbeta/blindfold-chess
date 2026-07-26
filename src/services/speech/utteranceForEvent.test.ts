import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import type { SpeechMode } from "@/api/localStore";
import type { GameAudioEvent } from "@/state/gameStore";
import { utteranceForEvent } from "./utteranceForEvent";

function moveEvent(san: "e4" | "exd5"): GameAudioEvent {
  const chess = new Chess();
  if (san === "e4") {
    const move = chess.moves({ verbose: true }).find((m) => m.san === "e4")!;
    return { kind: "move", move, by: "player", source: { kind: "voice", confidence: 1 } };
  }
  chess.load("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
  const move = chess.moves({ verbose: true }).find((m) => m.san === "exd5")!;
  return { kind: "move", move, by: "player", source: { kind: "voice", confidence: 1 } };
}

const EVENTS: Record<string, GameAudioEvent> = {
  move: moveEvent("e4"),
  capture: moveEvent("exd5"),
  illegal: { kind: "illegal-move", spoken: "knight to e9", source: { kind: "voice", confidence: 1 } },
  rejected: { kind: "rejected-move", piece: "n", to: "e5", reason: "illegal", source: { kind: "voice", confidence: 1 } },
  "not-understood": { kind: "not-understood", heard: "garbled" },
  "game-end": { kind: "game-end", reason: "checkmate" },
};

const SPEAKING_MODES: SpeechMode[] = ["engine", "both"];

describe("utteranceForEvent — tone suppression outside Silent mode", () => {
  for (const mode of SPEAKING_MODES) {
    for (const [kind, event] of Object.entries(EVENTS)) {
      it(`never produces a tone for "${kind}" in "${mode}" mode`, () => {
        const { utterance } = utteranceForEvent(event, mode, "letters", false);
        expect(utterance?.tone ?? null).toBeNull();
      });
    }
  }

  it(`never produces a tone for a repeated "not-understood" in a speaking mode`, () => {
    for (const mode of SPEAKING_MODES) {
      const { utterance } = utteranceForEvent(EVENTS["not-understood"], mode, "letters", true);
      expect(utterance?.tone ?? null).toBeNull();
    }
  });
});

describe("utteranceForEvent — tones in Silent mode", () => {
  for (const [kind, event] of Object.entries(EVENTS)) {
    it(`produces a tone for "${kind}"`, () => {
      const { utterance } = utteranceForEvent(event, "silent", "letters", false);
      expect(utterance?.tone).not.toBeNull();
    });
  }

  it("distinguishes a capture tone from a plain move tone", () => {
    expect(utteranceForEvent(EVENTS.move, "silent", "letters", false).utterance?.tone).toBe("move");
    expect(utteranceForEvent(EVENTS.capture, "silent", "letters", false).utterance?.tone).toBe("capture");
  });

  it("still beeps for a repeated not-understood (loop breaker swallows only the sentence)", () => {
    const { utterance } = utteranceForEvent(EVENTS["not-understood"], "silent", "letters", true);
    expect(utterance?.tone).toBe("error");
    expect(utterance?.clips).toBeNull();
  });
});

describe("utteranceForEvent — not-understood loop breaker", () => {
  it("speaks the sentence the first time and sets the flag", () => {
    const { utterance, spokeNotUnderstoodLast } = utteranceForEvent(EVENTS["not-understood"], "both", "letters", false);
    expect(utterance?.text).toBe("Sorry, I did not catch that.");
    expect(spokeNotUnderstoodLast).toBe(true);
  });

  it("suppresses the repeated sentence in a speaking mode (and stays silent — no tone either)", () => {
    const { utterance, spokeNotUnderstoodLast } = utteranceForEvent(EVENTS["not-understood"], "both", "letters", true);
    expect(utterance).toBeNull();
    expect(spokeNotUnderstoodLast).toBe(true);
  });

  it("clears on the next move event", () => {
    const { spokeNotUnderstoodLast } = utteranceForEvent(EVENTS.move, "both", "letters", true);
    expect(spokeNotUnderstoodLast).toBe(false);
  });
});

describe("utteranceForEvent — move readback rules unaffected by tone gating", () => {
  it("speaks a player's voice move in both mode", () => {
    const { utterance } = utteranceForEvent(EVENTS.move, "both", "letters", false);
    expect(utterance?.clips).toEqual(["pawn", "e", "4"]);
  });

  it("stays quiet (no utterance at all) for a typed move in engine mode", () => {
    const typed: GameAudioEvent = { ...EVENTS.move, source: { kind: "typed" } } as GameAudioEvent;
    const { utterance } = utteranceForEvent(typed, "engine", "letters", false);
    expect(utterance).toBeNull();
  });
});
