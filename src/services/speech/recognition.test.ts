import { describe, expect, it } from "vitest";
import { latestRecognitionAlternatives } from "./recognition";

function eventWith(isFinal: boolean, transcripts: string[]): SpeechRecognitionEvent {
  const result = Object.assign(
    transcripts.map((transcript) => ({ transcript, confidence: 1 })),
    { isFinal },
  );
  const results = Object.assign([result], { length: 1 });
  return { results } as unknown as SpeechRecognitionEvent;
}

describe("latestRecognitionAlternatives", () => {
  it("keeps an interim iOS result for onend fallback", () => {
    expect(latestRecognitionAlternatives(eventWith(false, ["e four", "before"]))).toEqual({
      alternatives: ["e four", "before"],
      isFinal: false,
    });
  });

  it("trims and drops empty alternatives", () => {
    expect(latestRecognitionAlternatives(eventWith(true, ["  knight f three  ", " "]))).toEqual({
      alternatives: ["knight f three"],
      isFinal: true,
    });
  });
});
