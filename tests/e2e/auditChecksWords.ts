import type { Page } from "@playwright/test";

// SPEC_opponent_chip_width.md -- split out of auditChecksDom.ts purely for
// this project's 300-line-per-file rule; auditChecks.ts is the one that
// interprets what this returns, same as the rest of that file's collectors.

export interface WordSplitResult {
  items: { label: string; detail: string }[];
}

/**
 * A word can render inside a button that's wide enough for it while still
 * being split across two lines when the button is too narrow (e.g.
 * `break-words` mid-word). Walks every word (split on whitespace) in every
 * visible button's text nodes and asserts a Range over just that word
 * reports a single client rect.
 */
export async function collectButtonWordSplit(page: Page): Promise<WordSplitResult> {
  return page.evaluate(() => {
    const items: { label: string; detail: string }[] = [];
    document.querySelectorAll<HTMLElement>("button, [role='button']").forEach((btn) => {
      if (btn.getAttribute("data-flat") === "square") return;
      const box = btn.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const cs = getComputedStyle(btn);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return;

      const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const text = node.textContent ?? "";
        const wordPattern = /\S+/g;
        let match: RegExpExecArray | null;
        while ((match = wordPattern.exec(text))) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
          // A word truncated by `text-overflow: ellipsis` reports two
          // client rects from Chromium's own rendering internals -- one for
          // the laid-out (unclipped) text, one for the painted (clipped)
          // text -- even though nothing actually wraps to a second line.
          // Both share the same `top`, unlike a real wrap, which always
          // moves to a new line (a different `top`). Counting distinct
          // tops, not raw rect count, is what tells the two cases apart.
          const distinctTops = new Set(rects.map((r) => Math.round(r.top)));
          if (distinctTops.size > 1) {
            const label = (btn.getAttribute("aria-label") || btn.textContent || "?").trim().slice(0, 40);
            items.push({ label, detail: `word "${match[0]}" split across ${distinctTops.size} lines` });
          }
        }
        node = walker.nextNode();
      }
    });
    return { items };
  });
}
