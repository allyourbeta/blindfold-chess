import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { waitForEngineReady, muteAudio, PHONE_USABLE } from "./helpers";
import { createErrorTracker, runChecks, type AuditContext, type Finding } from "./auditChecks";
import { walkMenu, walkSetupAndDraw, walkPlayFromMenu, walkPromotionChooser, walkLeaveConfirm, type RunFn } from "./auditWalkSteps";
import { walkEndgameLab } from "./auditWalkLab";

// SPEC_full_app_audit.md: a real-UI walkthrough of every screen, at every
// viewport/theme the app ships, checking for every mechanical defect listed
// in Part 2. Stays in the suite permanently (Part 4) -- any future screen,
// dialog, or control gets a checkpoint added to auditWalkSteps.ts or
// auditWalkLab.ts in the same commit that adds it.

interface Combo {
  label: string;
  viewport: { width: number; height: number };
  theme: "light" | "dark";
}

const COMBOS: Combo[] = [
  { label: "phone-usable", viewport: PHONE_USABLE, theme: "light" },
  { label: "phone-usable-dark", viewport: PHONE_USABLE, theme: "dark" },
  { label: "small-iphone", viewport: { width: 375, height: 647 }, theme: "light" },
  { label: "landscape", viewport: { width: 742, height: 393 }, theme: "light" },
];

async function openAppWithTheme(page: Page, theme: "light" | "dark") {
  await muteAudio(page);
  await page.addInitScript((t: string) => {
    localStorage.setItem("blindfoldShowTicker", "true");
    localStorage.setItem("blindfoldAssistMode", "assisted");
    localStorage.setItem("blindfoldTheme", t);
  }, theme);
  await page.goto("/");
}

for (const combo of COMBOS) {
  test.describe(`audit walk: ${combo.label}`, () => {
    test.use({ viewport: combo.viewport });

    test("walks every screen without a mechanical defect", async ({ page }, testInfo) => {
      // webkit-iphone only needs the one combo named in the spec -- every
      // other project (chromium, iphone) covers all four.
      test.skip(
        testInfo.project.name === "webkit-iphone" && combo.label !== "phone-usable",
        "webkit-iphone only covers PHONE_USABLE light, per SPEC_full_app_audit.md",
      );
      test.setTimeout(180_000);

      const findings: Finding[] = [];
      const ctx: AuditContext = {
        findings,
        viewport: combo.label,
        theme: combo.theme,
        tracker: createErrorTracker(page),
        errorCursor: { value: 0 },
        imagesSkippedForContrast: new Set(),
      };
      const run: RunFn = (checkpoint, opts) => runChecks(page, ctx, checkpoint, opts);

      await openAppWithTheme(page, combo.theme);
      await waitForEngineReady(page);

      await walkMenu(page, run);
      await walkSetupAndDraw(page, run);
      await walkPlayFromMenu(page, run);
      await walkPromotionChooser(page, run);
      await walkEndgameLab(page, run);
      await walkLeaveConfirm(page, run);

      const outDir = path.join(process.cwd(), "test-results", "audit-raw");
      mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, `${combo.label}-${testInfo.project.name}.json`);
      writeFileSync(
        outFile,
        JSON.stringify({ findings, skippedImages: Array.from(ctx.imagesSkippedForContrast) }, null, 2),
      );

      // SPEC_last_quirks_and_mute.md Part E: the player-move log green
      // (text-text-success) that SPEC_final_polish.md had to exempt here by
      // exact ratio is now green-800 (#166534) -- dark enough to clear
      // contrast on the beige page too. No exemption left: check F is
      // blocking with zero exceptions except the board's own rank/file
      // labels, which auditChecksDom.ts's collectContrast already excludes
      // by design (Lichess's own convention, not a gap in this check).
      expect(findings, `${findings.length} finding(s) -- see docs/AUDIT_FINDINGS.md`).toEqual([]);
    });
  });
}

// SPEC_opponent_chip_width.md -- 360px is narrower than any COMBOS viewport
// above and is where "Stockfish" (the longest Opponent value) is most likely
// to split or overflow its chip. Checks only the menu checkpoint, not the
// full walk: no other screen's layout is in scope for this spec.
test.describe("audit walk: menu-360 (Stockfish selected)", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("menu checkpoint has no mechanical defect", async ({ page }) => {
    await muteAudio(page);
    await page.addInitScript(() => {
      localStorage.setItem("blindfoldOpponent", "stockfish");
    });
    await page.goto("/");
    await waitForEngineReady(page);

    const findings: Finding[] = [];
    const ctx: AuditContext = {
      findings,
      viewport: "menu-360",
      theme: "light",
      tracker: createErrorTracker(page),
      errorCursor: { value: 0 },
      imagesSkippedForContrast: new Set(),
    };
    const run: RunFn = (checkpoint, opts) => runChecks(page, ctx, checkpoint, opts);

    await run("menu: home (Stockfish)");

    expect(findings, `${findings.length} finding(s) -- see docs/AUDIT_FINDINGS.md`).toEqual([]);
  });
});
