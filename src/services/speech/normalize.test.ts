import { describe, it, expect } from "vitest";
import { normalizeTranscript } from "./normalize";

describe("normalizeTranscript", () => {
  it("lowercases", () => {
    expect(normalizeTranscript("Knight F3")).toBe("knight f3");
  });

  it("converts number words to digits", () => {
    expect(normalizeTranscript("e four")).toBe("e 4");
    expect(normalizeTranscript("knight to f three")).toBe("knight to f 3");
  });

  it("converts NATO alphabet words to file letters", () => {
    expect(normalizeTranscript("bishop alpha four")).toBe("bishop a 4");
    expect(normalizeTranscript("charlie takes delta five")).toBe("c takes d 5");
  });

  it("collapses whitespace", () => {
    expect(normalizeTranscript("  knight   f3  ")).toBe("knight f3");
  });
});
