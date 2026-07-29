import { describe, it, expect } from "vitest";
import { installAdvice } from "./installState";

// Falsifier: goes red if someone already running the installed app is still
// invited to install it, if a captured prompt isn't preferred over manual
// instructions, or if a platform with neither route is told to do something
// it can't do.
describe("installAdvice", () => {
  it("says nothing at all when the app is already installed", () => {
    expect(installAdvice({ standalone: true, hasPrompt: true, isAppleTouch: true })).toEqual({
      kind: "installed",
    });
  });

  it("prefers a real prompt when the browser offered one", () => {
    expect(installAdvice({ standalone: false, hasPrompt: true, isAppleTouch: false })).toEqual({
      kind: "prompt",
    });
  });

  it("falls back to Share instructions on Apple touch devices, which allow no prompt", () => {
    expect(installAdvice({ standalone: false, hasPrompt: false, isAppleTouch: true })).toEqual({
      kind: "ios-manual",
    });
  });

  it("offers nothing where neither route exists", () => {
    expect(installAdvice({ standalone: false, hasPrompt: false, isAppleTouch: false })).toEqual({
      kind: "unavailable",
    });
  });
});
