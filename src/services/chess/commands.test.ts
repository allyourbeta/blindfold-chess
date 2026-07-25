import { describe, it, expect } from "vitest";
import { parseTypedCommand } from "./commands";

describe("parseTypedCommand", () => {
  it.each([
    ["peek", "peek"],
    ["resign", "resign"],
    ["takeback", "takeback"],
    ["undo", "takeback"],
    ["hint", "hint"],
    ["moves", "hint"],
    ["help", "hint"],
    ["fen", "fen"],
    ["pgn", "pgn"],
    ["history", "history"],
    ["stats", "history"],
    ["  PEEK  ", "peek"],
  ])("%s -> %s", (input, expected) => {
    expect(parseTypedCommand(input)).toBe(expected);
  });

  it("returns null for anything else, including real moves", () => {
    expect(parseTypedCommand("e4")).toBeNull();
    expect(parseTypedCommand("Nf3")).toBeNull();
    expect(parseTypedCommand("")).toBeNull();
  });
});
