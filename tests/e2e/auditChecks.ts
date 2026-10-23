import type { Page } from "@playwright/test";
import { collectControlBoxes, collectOverflow, collectContrast, countMutations } from "./auditChecksDom";

// SPEC_full_app_audit.md Part 2 -- the eight checks (A-H) run at every
// checkpoint of the walk. Kept out of audit-walk.spec.ts (not matched by
// testDir's spec glob, so Playwright never tries to run it as a suite of
// its own) purely to stay under this project's 300-line-per-file rule; the
// browser-side collectors this orchestrates live in auditChecksDom.ts for
// the same reason.

export interface Finding {
  viewport: string;
  theme: string;
  checkpoint: string;
  check: string; // "A".."H"
  element: string;
  detail: string;
}

export interface ErrorTracker {
  messages: string[];
}

/** Registers console/page-error listeners once per test; H reads from this. */
export function createErrorTracker(page: Page): ErrorTracker {
  const tracker: ErrorTracker = { messages: [] };
  page.on("console", (msg) => {
    if (msg.type() === "error") tracker.messages.push(msg.text());
  });
  page.on("pageerror", (err) => tracker.messages.push(String(err)));
  return tracker;
}

// Reused from raised-controls.spec.ts (SPEC_raised_controls.md) rather than
// imported -- Playwright spec files must not import each other, and this
// file isn't a spec, so the one real source of truth stays there; this is a
// deliberate, documented duplication of a four-item constant, not a check
// this audit loosened on its own judgment.
const ALLOWED_FLAT = ["square", "card", "icon", "ticker"];

// docs/targets/round-log-opponent-style.html fixes the castle/backspace row
// (Button.tsx's "keypadRow" size) at height:36px explicitly, and
// MoveList.tsx's ticker row (data-flat="ticker") is `min-h-9` (36px) by the
// same approved design -- Part 2's check B names this exact floor ("Visual
// height >= 36 px") for exactly these, not the usual 44px. Not a widened
// exemption invented by this audit: the mockup predates it.
const SIZE_36_LABELS = new Set(["O-O", "O-O-O", "Undo last entry"]);

export interface RunChecksOptions {
  /** During engine thinking or the peek timer -- G is expected to be noisy there. */
  skipStability?: boolean;
}

export interface AuditContext {
  findings: Finding[];
  viewport: string;
  theme: string;
  tracker: ErrorTracker;
  errorCursor: { value: number };
  imagesSkippedForContrast: Set<string>;
}

export async function runChecks(page: Page, ctx: AuditContext, checkpoint: string, opts: RunChecksOptions = {}): Promise<void> {
  function record(check: string, element: string, detail: string) {
    ctx.findings.push({ viewport: ctx.viewport, theme: ctx.theme, checkpoint, check, element, detail });
  }

  const boxes = await collectControlBoxes(page);
  for (const b of boxes) {
    if (b.disabled || b.exempt) continue;
    // A control behind an open dialog/sheet is correctly inert while it's
    // up (that's the whole point of a modal) -- only the dialog's own
    // contents are live. Likewise a control scrolled out of the viewport on
    // a scrolling screen (the menu's settings panel growing the page) was
    // never meant to be hit right now; endgames.spec.ts's own scan notes
    // the same thing for "a row below the fold."
    const liveNow = b.inViewport && !(b.dialogOpen && !b.inDialog);
    if (liveNow) {
      if (!b.hit) record("A", b.label, "elementFromPoint at its center did not resolve to this control");
      else if (b.blocked) record("A", b.label, "pointer-events: none on this control or an ancestor");
    }
    const heightFloor = SIZE_36_LABELS.has(b.label) || b.flat === "ticker" || b.shortscape ? 36 : 44;
    if (b.w < 44 - 0.5 || b.h < heightFloor - 0.5) {
      record("B", b.label, `hit box ${b.w.toFixed(0)}x${b.h.toFixed(0)}px, needs >= 44x${heightFloor}`);
    }
    // The 8-button promotion/disambiguation chooser is allowed to overflow
    // its own horizontally-scrolling strip rather than wrap
    // (MoveKeypad.tsx's entry-strip comment) -- escaping the VIEWPORT only
    // matters for a control that isn't reachable by scrolling its own
    // container back into view.
    if (!b.inHScroll) {
      const vw = page.viewportSize()?.width ?? 0;
      if (b.x + b.w > vw + 0.5 || b.x < -0.5) record("C", b.label, `control escapes the viewport horizontally (x ${b.x.toFixed(0)}, w ${b.w.toFixed(0)}, viewport ${vw})`);
    }
    if (b.flat !== null) {
      if (!ALLOWED_FLAT.includes(b.flat)) record("E", b.label, `bad data-flat="${b.flat}"`);
    } else if (!b.raisedOk) {
      record("E", b.label, "neither raised (gradient + 2px bottom edge) nor data-flat");
    }
  }
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i];
    if (a.disabled || a.exempt || !a.inViewport) continue;
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j];
      if (b.disabled || b.exempt || !b.inViewport) continue;
      if (a.dialogOpen && a.inDialog !== b.inDialog) continue; // dialog-over-background is expected, not an overlap bug
      const overlapX = Math.min(a.vx + a.vw, b.vx + b.vw) - Math.max(a.vx, b.vx);
      const overlapY = Math.min(a.vy + a.vh, b.vy + b.vh) - Math.max(a.vy, b.vy);
      if (overlapX > 1 && overlapY > 1) record("D", `${a.label} × ${b.label}`, `boxes overlap by ${overlapX.toFixed(0)}x${overlapY.toFixed(0)}px`);
    }
  }

  const overflow = await collectOverflow(page);
  if (overflow.htmlOverflow) record("C", "document", "horizontal page scroll: documentElement.scrollWidth > window.innerWidth");
  for (const o of overflow.items) record("C", o.label, o.detail);

  const contrast = await collectContrast(page);
  for (const f of contrast.failures) record("F", f.label, f.detail);
  // By element label alone, not per-checkpoint: the same handful of labels
  // (board coordinate text, raised-button text sitting over the gradient
  // background) recur at nearly every checkpoint, and a checkpoint-qualified
  // entry for each would dwarf the report the same way ungrouped contrast
  // findings did.
  for (const label of contrast.skippedOverImage) ctx.imagesSkippedForContrast.add(label);

  if (!opts.skipStability) {
    const mutations = await countMutations(page);
    if (mutations > 3) record("G", checkpoint, `${mutations} DOM mutations in a settled 1s window (> 3)`);
  }

  const newErrors = ctx.tracker.messages.slice(ctx.errorCursor.value);
  ctx.errorCursor.value = ctx.tracker.messages.length;
  for (const e of newErrors) record("H", checkpoint, e.slice(0, 200));
}
