import { expect, type Page } from "@playwright/test";
import { waitForEngineReady, keypad, submitMove, resignGame } from "./helpers";

// SPEC_full_app_audit.md Part 2 -- the checkpoint sequence itself (states 1-6
// of the spec's list), kept apart from audit-walk.spec.ts for the 300-line
// file rule. Every navigation here is a real tap/click/fill, never
// page.evaluate or a store call.

export type RunFn = (checkpoint: string, opts?: { skipStability?: boolean }) => Promise<void>;

async function loadFen(page: Page, fen: string) {
  const box = page.getByPlaceholder("Paste FEN string...");
  await box.fill(fen);
  await page.getByRole("button", { name: "Load" }).click();
}

/** State 1: menu, settings opened, each setting changed once and back. */
export async function walkMenu(page: Page, run: RunFn): Promise<void> {
  await waitForEngineReady(page);
  await run("menu: home");

  await page.getByRole("button", { name: /Color/ }).click();
  await expect(page.getByText("Game settings")).toBeVisible();
  await run("menu: settings open");

  const playAs = page.getByRole("radiogroup", { name: "Play as" });
  await playAs.getByRole("radio", { name: "Black" }).click();
  await run("menu: settings — Play as Black");
  await playAs.getByRole("radio", { name: "White" }).click();

  const opponent = page.getByRole("radiogroup", { name: "Opponent" });
  await opponent.getByRole("radio", { name: "Stockfish" }).click();
  await run("menu: settings — Opponent Stockfish (Level shown)");
  const level = page.getByRole("button", { name: "Max", exact: true });
  await level.click();
  await run("menu: settings — Level Max");
  await page.getByRole("button", { name: "Club", exact: true }).click();
  await opponent.getByRole("radio", { name: "Maia 1900" }).click();
  await run("menu: settings — Opponent Maia (Variance shown)");

  const wild = page.getByRole("button", { name: "Wild", exact: true });
  await wild.click();
  await run("menu: settings — Variance Wild");
  await page.getByRole("button", { name: "Human", exact: true }).click();

  const speech = page.getByRole("radiogroup", { name: "Engine speaks" });
  await speech.getByRole("radio", { name: "On" }).click();
  await run("menu: settings — Engine speaks On (Say files as shown)");
  const fileNaming = page.getByRole("radiogroup", { name: "Say files as" });
  await fileNaming.getByRole("radio", { name: "NATO" }).click();
  await run("menu: settings — Say files as NATO");
  await fileNaming.getByRole("radio", { name: "Alpha" }).click();
  await speech.getByRole("radio", { name: "Off" }).click();

  const assist = page.getByRole("radiogroup", { name: "Keypad assistance" });
  await assist.getByRole("radio", { name: "Strict" }).click();
  await run("menu: settings — Keypad assistance Strict");
  await assist.getByRole("radio", { name: "Assisted" }).click();

  await page.getByRole("button", { name: /Color/ }).click(); // closes the panel again
}

/**
 * States 2 + 4: Position Setup, ending on the K+B vs K draw -- Edit position
 * returns here with the draw position preloaded, which doubles as state 4's
 * own checkpoint without a second excursion.
 */
export async function walkSetupAndDraw(page: Page, run: RunFn): Promise<void> {
  await page.getByRole("button", { name: /set up a position/i }).click();
  await run("setup: default");

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await run("setup: cleared");

  await page.getByRole("button", { name: "white king", exact: true }).click();
  await page.getByLabel("square e1").click();
  await run("setup: a piece placed");

  await page.getByRole("button", { name: "Rotate the board 180 degrees" }).click();
  await run("setup: flipped");
  await page.getByRole("button", { name: "Rotate the board 180 degrees" }).click();

  await page.getByRole("radiogroup", { name: "Side to move" }).getByRole("radio", { name: "Black" }).click();
  await run("setup: Black to move");
  await page.getByRole("radiogroup", { name: "Side to move" }).getByRole("radio", { name: "White" }).click();

  const oooButton = page.getByRole("button", { name: "White O-O-O" });
  await oooButton.click();
  await run("setup: castling toggle");

  await loadFen(page, "zzz not a fen");
  await run("setup: invalid FEN (error shown)");
  await expect(page.locator("p.text-text-error")).toBeVisible();

  await loadFen(page, "4k3/8/8/8/8/8/8/2BK4 w - - 0 1");
  await run("setup: valid FEN loaded (error cleared)");

  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await run("play-from-setup: draw panel");
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Edit position" }).click();
  await run("play-from-setup: Edit position -> setup shows the position");

  await page.getByRole("button", { name: "Back to menu" }).click();
}

/** State 3: a normal game from the menu. */
export async function walkPlayFromMenu(page: Page, run: RunFn): Promise<void> {
  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();
  await run("play: started");

  await page.getByLabel("Peek at the board").click();
  await run("play: peeking", { skipStability: true });
  await page.waitForTimeout(3200); // past the 3s auto-hide, so the next checkpoint starts clean

  await page.getByRole("button", { name: "Hint" }).click();
  await run("play: hint shown");

  await submitMove(page, "e4");
  await run("play: move submitted", { skipStability: true }); // engine is thinking
  await expect(page.getByText(/^(White|Black): /)).toHaveCount(2, { timeout: 15_000 });
  await expect(page.getByText(/Your move ·/)).toBeVisible();
  await run("play: engine replied");

  await page.getByRole("button", { name: /Takeback/ }).click();
  await run("play: after takeback");

  await page.getByRole("button", { name: "More actions" }).click();
  const sheet = page.getByRole("dialog", { name: "More actions" });
  await run("play: More sheet open");

  for (const name of [/Engine speaks/, "PGN", "FEN", "History"]) {
    await sheet.getByRole("button", { name }).click();
    await run(`play: More — ${typeof name === "string" ? name : "Engine speaks"} tapped`);
  }
  await sheet.getByRole("button", { name: /Engine speaks/ }).click(); // restore speech off
  await sheet.getByRole("button", { name: "Close more actions" }).click();
  await run("play: More sheet closed");

  await page.getByRole("button", { name: "Resign" }).click();
  await run("play: resign confirm open");

  await page.getByRole("dialog").filter({ hasText: "Resign this game?" }).getByRole("button", { name: "Resign", exact: true }).click();
  await run("play: game-over panel (normal game)");
  await expect(page.getByRole("dialog").getByRole("button", { name: "New Game" })).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Menu" }).click();
}

/** A pawn-on-the-7th set-up game, purely to reach the promotion chooser. */
export async function walkPromotionChooser(page: Page, run: RunFn): Promise<void> {
  await page.getByRole("button", { name: /set up a position/i }).click();
  await loadFen(page, "4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  await page.getByRole("button", { name: "Play Blindfold" }).click();
  await expect(keypad(page)).toBeVisible();
  await run("promotion: set-up game started");

  await submitMove(page, "a8");
  await run("promotion: chooser open");
  await expect(keypad(page).getByRole("group", { name: "Move chooser" })).toBeVisible();
  await keypad(page).getByRole("group", { name: "Move chooser" }).getByRole("button", { name: "Queen" }).click();
  await run("promotion: resolved", { skipStability: true }); // the engine may start thinking immediately

  await resignGame(page);
  await run("play: game-over panel (set-up game)");
  await page.getByRole("dialog").getByRole("button", { name: "Menu" }).click();
}

/** State 6: the leave-game confirm, reached via the Back arrow mid-game. */
export async function walkLeaveConfirm(page: Page, run: RunFn): Promise<void> {
  await page.getByRole("button", { name: /New Game/ }).click();
  await expect(keypad(page)).toBeVisible();

  await page.getByLabel("Back to menu").click();
  await run("play: leave confirm open");
  await page.getByRole("dialog").filter({ hasText: "Leave this game?" }).getByRole("button", { name: "Stay" }).click();
  await run("play: leave confirm cancelled (Stay)");

  await page.getByLabel("Back to menu").click();
  await page.getByRole("dialog").filter({ hasText: "Leave this game?" }).getByRole("button", { name: "Leave", exact: true }).click();
  await run("menu: after leaving a game");
}
