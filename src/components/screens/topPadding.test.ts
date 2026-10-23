import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * SPEC_last_quirks_and_mute.md Part B -- every screen's content must start
 * 12px (0.75rem) below the status bar, not exactly at it. Chromium (what
 * this suite's e2e run uses) can't emulate an iPhone's safe-area inset, so
 * an e2e check can only confirm the CLASS is present, never the rendered
 * gap on a real notch -- this source-level test is what actually guards the
 * `+ 0.75rem` term itself from silently being dropped or changed.
 */

const SCREENS = [
  "../endgames/EndgamesHome.tsx",
  "../endgames/EndgamesPosition.tsx",
  "../endgames/EndgamesFavorites.tsx",
  "../endgames/EndgamesSize.tsx",
  "./SetupScreen.tsx",
  "./MenuScreen.tsx",
  "./PlayScreen.tsx",
];

const GAP_RULE = "calc(env(safe-area-inset-top)+0.75rem)";

describe("top padding is always status bar + 12px", () => {
  for (const relPath of SCREENS) {
    it(`${relPath} uses the gap rule`, () => {
      const text = readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), "utf8");
      expect(text).toContain(GAP_RULE);
    });
  }
});
