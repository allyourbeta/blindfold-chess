import type { Page } from "@playwright/test";

// SPEC_full_app_audit.md Part 2 -- the browser-side DOM collectors behind
// checks A-E and G. Split out of auditChecks.ts purely for this project's
// 300-line-per-file rule; auditChecks.ts is the one that interprets what
// these return.

export const CONTROL_SELECTOR = "button, [role='button'], a";

// Button.tsx's own "sm" and "chooser" sizes drop to `shortscape:h-9` (36px)
// -- the exact same approved floor keypadRow uses unconditionally, just
// gated on the same shortscape media query the app's CSS already keys off
// (src/index.css's `@custom-variant shortscape`).
export const SHORTSCAPE_MEDIA = "(orientation: landscape) and (max-height: 560px)";

export interface ControlBox {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hit: boolean;
  blocked: boolean;
  exempt: boolean;
  disabled: boolean;
  flat: string | null;
  raisedOk: boolean;
  dialogOpen: boolean;
  inDialog: boolean;
  inViewport: boolean;
  inHScroll: boolean;
  shortscape: boolean;
  /** The painted rect, after intersecting with every clipping ancestor and the window -- what D (overlap) must compare, not the nominal box. */
  vx: number;
  vy: number;
  vw: number;
  vh: number;
}

export async function collectControlBoxes(page: Page): Promise<ControlBox[]> {
  const shortscape = await page.evaluate((media) => window.matchMedia(media).matches, SHORTSCAPE_MEDIA);
  return page.evaluate(({ selector, shortscape }) => {
    function pointerEventsBlocked(el: Element): boolean {
      let n: Element | null = el;
      while (n) {
        if (getComputedStyle(n).pointerEvents === "none") return true;
        n = n.parentElement;
      }
      return false;
    }
    const openDialog = document.querySelector('[role="dialog"]');
    // getBoundingClientRect() reports an element's geometric position even
    // when a scrolling ancestor (not the window) has clipped most or all of
    // it away -- e.g. the menu's settings panel growing the page and
    // nudging a chip above `<main>`'s own top edge. Intersecting with every
    // clipping ancestor's own box (then the window) gives the rect that's
    // actually painted, which is what a real tap -- and this check's hit
    // test -- lands on, not the nominal full-size box.
    function visibleRect(el: Element, r: DOMRect): { top: number; bottom: number; left: number; right: number } {
      let top = r.top;
      let bottom = r.bottom;
      let left = r.left;
      let right = r.right;
      let n: Element | null = el.parentElement;
      while (n && n !== document.body) {
        const cs = getComputedStyle(n);
        const clipsY = cs.overflowY === "hidden" || cs.overflowY === "auto" || cs.overflowY === "scroll" || cs.overflow === "clip";
        const clipsX = cs.overflowX === "hidden" || cs.overflowX === "auto" || cs.overflowX === "scroll";
        if (clipsY || clipsX) {
          const nr = n.getBoundingClientRect();
          if (clipsY) {
            top = Math.max(top, nr.top);
            bottom = Math.min(bottom, nr.bottom);
          }
          if (clipsX) {
            left = Math.max(left, nr.left);
            right = Math.min(right, nr.right);
          }
        }
        n = n.parentElement;
      }
      top = Math.max(top, 0);
      left = Math.max(left, 0);
      bottom = Math.min(bottom, window.innerHeight);
      right = Math.min(right, window.innerWidth);
      return { top, bottom, left, right };
    }
    function scrollsHorizontally(el: Element): boolean {
      let n: Element | null = el.parentElement;
      while (n) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
        n = n.parentElement;
      }
      return false;
    }
    const out: ControlBox[] = [];
    document.querySelectorAll(selector).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return;
      const disabled = (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";
      const exempt = !!el.closest('[aria-hidden="true"]') || el.getAttribute("data-flat") === "square";
      const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("data-testid") || "?")
        .trim()
        .slice(0, 40);
      const vis = visibleRect(el, r);
      const visible = vis.bottom > vis.top && vis.right > vis.left;
      const cx = visible ? (vis.left + vis.right) / 2 : r.x + r.width / 2;
      const cy = visible ? (vis.top + vis.bottom) / 2 : r.y + r.height / 2;
      const atPoint = document.elementFromPoint(cx, cy);
      const hit = !!atPoint && (el.contains(atPoint) || atPoint.closest(selector) === el);
      const flat = el.getAttribute("data-flat");
      const hasGradient = cs.backgroundImage.includes("gradient");
      const bottomEdge = Math.abs(parseFloat(cs.borderBottomWidth) - 2) < 0.5;
      out.push({
        label,
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        hit,
        blocked: pointerEventsBlocked(el),
        exempt,
        disabled,
        flat,
        raisedOk: hasGradient && bottomEdge,
        dialogOpen: !!openDialog,
        inDialog: !!openDialog && openDialog.contains(el),
        inViewport: visible,
        inHScroll: scrollsHorizontally(el),
        shortscape,
        vx: visible ? vis.left : r.x,
        vy: visible ? vis.top : r.y,
        vw: visible ? vis.right - vis.left : r.width,
        vh: visible ? vis.bottom - vis.top : r.height,
      });
    });
    return out;
  }, { selector: CONTROL_SELECTOR, shortscape });
}

export interface TextOverflowResult {
  items: { label: string; detail: string }[];
}

/**
 * SPEC_last_quirks_and_mute.md Part D -- a text node can spill past its own
 * button's border box even when nothing has `overflow: hidden` (the bug
 * collectOverflow's own check can't see: it only looks at elements that ARE
 * clipping something). Walks every text node under every visible button and
 * takes the union of its rendered Range rects, not the button's own
 * scrollWidth -- a button's content box can be exactly as wide as its text
 * and still report no overflow by that measure alone.
 */
export async function collectButtonTextOverflow(page: Page): Promise<TextOverflowResult> {
  return page.evaluate(() => {
    const TOLERANCE = 1;
    const items: { label: string; detail: string }[] = [];
    document.querySelectorAll<HTMLElement>("button, [role='button']").forEach((btn) => {
      // Square.tsx's coordinate labels sit by design right at the square's
      // own corner/edge (Lichess's convention) -- the same shape of
      // "noisy on a legitimate design" case collectContrast already
      // exempts for this exact element via `[data-square]`.
      if (btn.getAttribute("data-flat") === "square") return;
      const box = btn.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const cs = getComputedStyle(btn);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return;

      // Tailwind's `truncate` (overflow-x: hidden + text-overflow: ellipsis)
      // lays the full-width text box out before clipping it visually -- a
      // Range over that text reports the UNCLIPPED width, which would
      // otherwise look identical to a real overflow. collectOverflow's own
      // check carries the same exemption for the same reason.
      function isDeliberatelyTruncated(el: Element | null): boolean {
        let n = el;
        while (n && n !== btn.parentElement) {
          if (getComputedStyle(n).textOverflow === "ellipsis") return true;
          n = n.parentElement;
        }
        return false;
      }

      let minLeft = Infinity;
      let minTop = Infinity;
      let maxRight = -Infinity;
      let maxBottom = -Infinity;
      let found = false;
      const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if ((node.textContent ?? "").trim() && !isDeliberatelyTruncated(node.parentElement)) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of Array.from(range.getClientRects())) {
            if (r.width === 0 && r.height === 0) continue;
            found = true;
            minLeft = Math.min(minLeft, r.left);
            minTop = Math.min(minTop, r.top);
            maxRight = Math.max(maxRight, r.right);
            maxBottom = Math.max(maxBottom, r.bottom);
          }
        }
        node = walker.nextNode();
      }
      if (!found) return;
      const escapes =
        minLeft < box.left - TOLERANCE ||
        maxRight > box.right + TOLERANCE ||
        minTop < box.top - TOLERANCE ||
        maxBottom > box.bottom + TOLERANCE;
      if (!escapes) return;
      const label = (btn.getAttribute("aria-label") || btn.textContent || "?").trim().slice(0, 40);
      items.push({
        label,
        detail: `text extent [${minLeft.toFixed(0)},${minTop.toFixed(0)},${maxRight.toFixed(0)},${maxBottom.toFixed(0)}] escapes border box [${box.left.toFixed(0)},${box.top.toFixed(0)},${box.right.toFixed(0)},${box.bottom.toFixed(0)}]`,
      });
    });
    return { items };
  });
}

export interface OverflowResult {
  htmlOverflow: boolean;
  items: { label: string; detail: string }[];
}

export async function collectOverflow(page: Page): Promise<OverflowResult> {
  return page.evaluate(() => {
    const items: { label: string; detail: string }[] = [];
    document.querySelectorAll<HTMLElement>("*").forEach((el) => {
      // The message log scrolls by design, and so does anything that bounds
      // it: an ancestor's scrollHeight sums the log's own (fine, internally
      // scrollable) overflow right along with everything else in it, which
      // would otherwise flag PlayScreen's own outer grid every time the log
      // has enough messages to want more room than its `minmax(..., 1fr)`
      // row currently has.
      if (el.closest('[data-testid="message-log"]') || el.querySelector('[data-testid="message-log"]')) return;
      const cs = getComputedStyle(el);
      if (cs.textOverflow === "ellipsis") return; // Tailwind's `truncate` -- deliberate, not a clipping bug
      const hidden = cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.overflowY === "hidden";
      if (!hidden) return;
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
        const label = el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || el.tagName;
        items.push({
          label,
          detail: `scroll ${el.scrollWidth}x${el.scrollHeight} > client ${el.clientWidth}x${el.clientHeight}`,
        });
      }
    });
    return { htmlOverflow: document.documentElement.scrollWidth > window.innerWidth + 1, items };
  });
}

export interface ContrastResult {
  failures: { label: string; detail: string }[];
  skippedOverImage: string[];
}

/** WCAG 2.x contrast, walking ancestors for the first opaque background; elements sitting over an image/gradient are skipped and logged, never failed. */
export async function collectContrast(page: Page): Promise<ContrastResult> {
  return page.evaluate(() => {
    function parseColor(str: string): { r: number; g: number; b: number; a: number } | null {
      const m = str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(",").map((s) => parseFloat(s));
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
    }
    function relLuminance(r: number, g: number, b: number): number {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }
    function contrastRatio(c1: [number, number, number], c2: [number, number, number]): number {
      const L1 = relLuminance(...c1);
      const L2 = relLuminance(...c2);
      const lighter = Math.max(L1, L2);
      const darker = Math.min(L1, L2);
      return (lighter + 0.05) / (darker + 0.05);
    }
    function effectiveBackground(el: Element): { color: [number, number, number] } | { overImage: true } {
      let node: Element | null = el;
      while (node) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage && cs.backgroundImage !== "none") return { overImage: true };
        const bg = parseColor(cs.backgroundColor);
        if (bg && bg.a > 0.99) return { color: [bg.r, bg.g, bg.b] };
        node = node.parentElement;
      }
      return { color: [255, 255, 255] };
    }

    const failures: { label: string; detail: string }[] = [];
    const skippedOverImage: string[] = [];
    document.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const hasDirectText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
      if (!hasDirectText) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || Number(cs.opacity) === 0) return;
      if (el.closest('[aria-hidden="true"]')) return;
      // Square.tsx's own rationale: the rank/file coordinate label is drawn
      // in the opposite of the square's own colour "same convention Lichess
      // uses" -- the spec's own example of a check that's noisy on a
      // legitimate design ("e.g. the board").
      if (el.closest("[data-square]")) return;
      const fg = parseColor(cs.color);
      if (!fg) return;
      const bg = effectiveBackground(el);
      const label = (el.getAttribute("aria-label") || el.textContent || "?").trim().slice(0, 40);
      if ("overImage" in bg) {
        skippedOverImage.push(label);
        return;
      }
      const fontSize = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = fontSize >= 24 || (fontSize >= 18.66 && bold);
      const threshold = large ? 3 : 4.5;
      const ratio = contrastRatio([fg.r, fg.g, fg.b], bg.color);
      if (ratio < threshold) {
        failures.push({ label, detail: `contrast ${ratio.toFixed(2)}:1, needs >= ${threshold}:1 (font ${fontSize}px${bold ? " bold" : ""})` });
      }
    });
    return { failures, skippedOverImage };
  });
}

/** A 1s MutationObserver window, after a 500ms settle -- G's stability check. */
export async function countMutations(page: Page): Promise<number> {
  await page.waitForTimeout(500);
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let n = 0;
        const obs = new MutationObserver((muts) => {
          n += muts.length;
        });
        obs.observe(document.body, { attributes: true, childList: true, subtree: true, characterData: true });
        setTimeout(() => {
          obs.disconnect();
          resolve(n);
        }, 1000);
      }),
  );
}
