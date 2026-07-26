import { describe, expect, it } from "vitest";
import { isOwnEcho } from "./echo";

// The remembered texts below are what drainQueue records: clip-id joins for
// clip utterances ("pawn e 6 not-legal") and plain sentences for text ones.
const REJECTION = "pawn e 6 not-legal";
const NATO_REJECTION = "pawn nato-e 6 not-legal";
const NOT_UNDERSTOOD = "Sorry, I did not catch that.";

describe("isOwnEcho", () => {
  it("drops a mangled echo of a rejection sentence", () => {
    // Real capture from the self-hearing loop: the app said "Pawn e6 is not
    // legal" and the recognizer heard this.
    expect(isOwnEcho('phone E6 is not legal', [REJECTION])).toBe(true);
  });

  it("drops an echo of the not-understood phrase", () => {
    expect(isOwnEcho("sorry I did not catch that", [NOT_UNDERSTOOD])).toBe(true);
  });

  it("drops a NATO-mode rejection echo", () => {
    expect(isOwnEcho("pawn echo 6 is not legal", [NATO_REJECTION])).toBe(true);
  });

  it("keeps a real move that shares words with a remembered phrase", () => {
    expect(isOwnEcho("knight d5", [REJECTION, NOT_UNDERSTOOD])).toBe(false);
  });

  it("keeps short moves", () => {
    expect(isOwnEcho("e4", [REJECTION, NOT_UNDERSTOOD])).toBe(false);
    expect(isOwnEcho("queen takes f7", [REJECTION])).toBe(false);
  });

  it("keeps everything when nothing has been spoken", () => {
    expect(isOwnEcho("pawn e6", [])).toBe(false);
  });

  it("ignores empty transcripts", () => {
    expect(isOwnEcho("", [REJECTION])).toBe(false);
  });
});
