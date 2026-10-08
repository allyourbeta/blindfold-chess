import { describe, it, expect } from "vitest";
import { categoryToScore, normalizeGameResult, swapScore } from "./resultScore";

describe("categoryToScore (SPEC_buttons_results.md decisions)", () => {
  it("a win for the side to move is a win for whoever that is", () => {
    expect(categoryToScore("win", "w")).toBe("1-0");
    expect(categoryToScore("win", "b")).toBe("0-1");
  });

  it("a loss for the side to move is a win for the other side", () => {
    expect(categoryToScore("loss", "w")).toBe("0-1");
    expect(categoryToScore("loss", "b")).toBe("1-0");
  });

  it("draw, cursed-win and blessed-loss all score as a draw, either side to move", () => {
    for (const category of ["draw", "cursed-win", "blessed-loss"]) {
      expect(categoryToScore(category, "w"), category).toBe("1/2-1/2");
      expect(categoryToScore(category, "b"), category).toBe("1/2-1/2");
    }
  });

  it("maybe-*, unknown and anything else give no result", () => {
    for (const category of ["maybe-win", "maybe-loss", "unknown", "unreachable", null, undefined]) {
      expect(categoryToScore(category, "w"), String(category)).toBe(null);
      expect(categoryToScore(category, "b"), String(category)).toBe(null);
    }
  });
});

describe("normalizeGameResult", () => {
  it("passes through the three real results", () => {
    expect(normalizeGameResult("1-0")).toBe("1-0");
    expect(normalizeGameResult("0-1")).toBe("0-1");
    expect(normalizeGameResult("1/2-1/2")).toBe("1/2-1/2");
  });

  it("gives no result for '*', missing, or malformed headers", () => {
    expect(normalizeGameResult("*")).toBe(null);
    expect(normalizeGameResult(undefined)).toBe(null);
    expect(normalizeGameResult("")).toBe(null);
    expect(normalizeGameResult("1-0 ")).toBe(null);
  });
});

describe("swapScore", () => {
  it("swaps a decisive result and leaves a draw alone", () => {
    expect(swapScore("1-0")).toBe("0-1");
    expect(swapScore("0-1")).toBe("1-0");
    expect(swapScore("1/2-1/2")).toBe("1/2-1/2");
  });
});
