import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { waitForEngineReady, PHONE_USABLE } from "./helpers";
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

      // Check F (contrast) findings are always an EXISTING design token pair
      // -- this audit is never allowed to introduce a new colour (Part 3.5),
      // so every ratio it can measure was already shipped and approved
      // before this run. Per the spec's own pre-answered item ("Contrast
      // fails on an approved colour pair? Report under Needs Ashish; don't
      // change the colour"), they're reported in full below and in
      // docs/AUDIT_FINDINGS.md, but they don't gate this test the way a
      // mechanical defect does.
      const blocking = findings.filter((f) => f.check !== "F");
      expect(blocking, `${blocking.length} finding(s) -- see docs/AUDIT_FINDINGS.md`).toEqual([]);
    });
  });
}
