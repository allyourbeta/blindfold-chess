import { test, expect, type Page } from "@playwright/test";
import { startStandardGame, submitMove } from "./helpers";

/**
 * Reproduces "the message log's top line is cut off under the ticker" --
 * `scrollIntoView({ block: "end" })` on a sentinel at the log's bottom was
 * free to scroll any `overflow-hidden` ANCESTOR of the log too, not just the
 * log itself (same bug class as endgames-scroll.spec.ts). Walks every
 * ancestor from the log up to <body> and requires each one's scrollTop to
 * stay 0 -- only the log itself is allowed to scroll, and only when it is
 * actually full.
 */
async function assertAncestorsUnscrolled(page: Page) {
  const ancestors = await page.evaluate(() => {
    const log = document.querySelector('[data-testid="message-log"]') as HTMLElement | null;
    if (!log) throw new Error("message-log not found");
    const out: { tag: string; testid: string; scrollTop: number }[] = [];
    let el = log.parentElement;
    while (el) {
      out.push({ tag: el.tagName, testid: el.getAttribute("data-testid") ?? "", scrollTop: el.scrollTop });
      el = el.parentElement;
    }
    return out;
  });
  const scrolled = ancestors.filter((a) => a.scrollTop !== 0);
  expect(scrolled, `ancestor chain: ${JSON.stringify(ancestors)}`).toEqual([]);
}

async function assertLogNotClipped(page: Page) {
  await assertAncestorsUnscrolled(page);

  const state = await page.evaluate(() => {
    const log = document.querySelector('[data-testid="message-log"]') as HTMLElement | null;
    if (!log) throw new Error("message-log not found");
    const first = log.firstElementChild as HTMLElement | null;
    return {
      full: log.scrollHeight > log.clientHeight,
      scrollTop: log.scrollTop,
      logTop: log.getBoundingClientRect().top,
      firstMessageTop: first ? first.getBoundingClientRect().top : null,
    };
  });

  if (!state.full) {
    expect(state.scrollTop, JSON.stringify(state)).toBe(0);
    expect(state.firstMessageTop, JSON.stringify(state)).not.toBeNull();
    expect(state.firstMessageTop! + 0.5, JSON.stringify(state)).toBeGreaterThanOrEqual(state.logTop);
  }
}

test("log is never clipped and no ancestor is scrolled", async ({ page }) => {
  await startStandardGame(page);
  await assertLogNotClipped(page);

  await submitMove(page, "e4");
  await expect(page.getByText(/^Black: /)).toBeVisible({ timeout: 15_000 });
  await assertLogNotClipped(page);
});

/**
 * "Predictable" randomness (used verbatim from maia-game.spec.ts) makes
 * Maia's replies a deterministic argmax, so this exact 6-move sequence is
 * known in advance to produce 12 ply without an illegal or surprising
 * engine reply derailing the run. Forces the iPhone viewport regardless of
 * project so the log reliably overflows on `chromium` too, which otherwise
 * has far more vertical room.
 */
test("auto-scroll still reaches the newest message", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("blindfoldRandomness", "predictable");
  });
  await startStandardGame(page);

  const playerMoves = ["e4", "Nf3", "Bc4", "d3", "c3", "Qb3"];
  let full = false;
  for (const move of playerMoves) {
    await submitMove(page, move);
    full = await page.evaluate(() => {
      const log = document.querySelector('[data-testid="message-log"]') as HTMLElement;
      return log.scrollHeight > log.clientHeight;
    });
    if (full) break;
  }
  expect(full, "log never became full within 12 plies").toBe(true);

  await assertAncestorsUnscrolled(page);

  const band = await page.evaluate(() => {
    const log = document.querySelector('[data-testid="message-log"]') as HTMLElement;
    const last = log.lastElementChild as HTMLElement;
    const logBox = log.getBoundingClientRect();
    const lastBox = last.getBoundingClientRect();
    return { logTop: logBox.top, logBottom: logBox.bottom, lastBottom: lastBox.bottom };
  });
  expect(band.lastBottom, JSON.stringify(band)).toBeLessThanOrEqual(band.logBottom + 0.5);
  expect(band.lastBottom, JSON.stringify(band)).toBeGreaterThan(band.logTop);
});

/** Same overflow loop as the test above, then scrolls up and checks a new message doesn't yank the view back down. */
test("scrolling up to reread stays put when a new message arrives", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("blindfoldRandomness", "predictable");
  });
  await startStandardGame(page);

  const playerMoves = ["e4", "Nf3", "Bc4", "d3", "c3", "Qb3"];
  // A bare few pixels of overflow would fall inside AT_BOTTOM_THRESHOLD
  // itself once scrolled up, making "at the top" indistinguishable from
  // "at the bottom" -- comfortably more than that margin is required
  // before the loop stops.
  let full = false;
  let playedCount = 0;
  for (const move of playerMoves) {
    await submitMove(page, move);
    await expect(page.getByText(/^Black: /).last()).toBeVisible({ timeout: 15_000 });
    playedCount++;
    full = await page.evaluate(() => {
      const log = document.querySelector('[data-testid="message-log"]') as HTMLElement;
      return log.scrollHeight - log.clientHeight > 100;
    });
    if (full) break;
  }
  expect(full, "log never overflowed comfortably within 12 plies").toBe(true);
  // At least one more prepared move is left in the sequence to play after
  // scrolling up -- fails loudly here rather than submitting an unplanned
  // (possibly illegal) move if the log fills before move 6.
  expect(playedCount, "no move left in the prepared sequence to play after scrolling up").toBeLessThan(
    playerMoves.length,
  );

  await page.evaluate(() => {
    const log = document.querySelector('[data-testid="message-log"]') as HTMLElement;
    log.scrollTop = 0;
    log.dispatchEvent(new Event("scroll"));
  });

  await submitMove(page, playerMoves[playedCount]);
  await expect(page.getByText(/^Black: /).last()).toBeVisible({ timeout: 15_000 });

  const scrollTop = await page.evaluate(() => {
    const log = document.querySelector('[data-testid="message-log"]') as HTMLElement;
    return log.scrollTop;
  });
  expect(scrollTop).toBeLessThan(24);
});
