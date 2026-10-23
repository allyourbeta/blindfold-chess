import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import type { Finding } from "./auditChecks";

interface RawFile {
  findings: Finding[];
  skippedImages: string[];
}

const CHECK_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

function renderMarkdown(findings: Finding[], skippedImages: Set<string>, runCount: number): string {
  let sha = "unknown";
  try {
    sha = execSync("git rev-parse HEAD").toString().trim();
  } catch {
    // leave as "unknown" -- not worth failing the run over
  }
  const byCheck = new Map<string, number>();
  for (const f of findings) byCheck.set(f.check, (byCheck.get(f.check) ?? 0) + 1);

  const lines: string[] = [
    "# AUDIT_FINDINGS.md",
    "",
    `Generated ${new Date().toLocaleString()} at ${sha}.`,
    "",
    `${findings.length} finding(s) across ${runCount} viewport/theme/project run(s).`,
    "",
    ...CHECK_ORDER.map((c) => `- ${c}: ${byCheck.get(c) ?? 0}`),
    "",
  ];

  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const blocking = findings.filter((f) => f.check !== "F");
  const contrast = findings.filter((f) => f.check === "F");

  if (blocking.length === 0) {
    lines.push("No blocking (A-E, G, H) findings. The walk is mechanically clean.");
  } else {
    lines.push("## Blocking findings (gate the walker test)", "", "| viewport | theme | checkpoint | check | element | detail |", "|---|---|---|---|---|---|");
    for (const f of blocking) {
      lines.push(`| ${f.viewport} | ${f.theme} | ${esc(f.checkpoint)} | ${f.check} | ${esc(f.element)} | ${esc(f.detail)} |`);
    }
  }

  if (contrast.length > 0) {
    // Grouped by signature, not one row per occurrence -- the same handful
    // of existing text/background token pairs recur at nearly every
    // checkpoint, and a 1500-row table of the same ~40 pairs is not what
    // Part 2 means by "a readable docs/AUDIT_FINDINGS.md". Full detail,
    // including every checkpoint, stays in test-results/audit-findings.json.
    lines.push(
      "",
      "## Needs Ashish -- contrast on existing, already-shipped colour tokens (non-blocking)",
      "",
      "Every pair below is an existing design token this audit is not allowed to recolour (SPEC_full_app_audit.md Part 3.5). Reported per the spec's own pre-answered guidance, not auto-fixed.",
      "",
      "| element | detail | occurrences | seen in |",
      "|---|---|---|---|",
    );
    const groups = new Map<string, { detail: string; count: number; combos: Set<string> }>();
    for (const f of contrast) {
      const key = `${f.element}||${f.detail.replace(/[0-9.]+/g, "#")}`;
      const g = groups.get(key) ?? { detail: f.detail, count: 0, combos: new Set<string>() };
      g.count++;
      g.combos.add(`${f.viewport}/${f.theme}`);
      groups.set(key, g);
    }
    const sorted = Array.from(groups.entries()).sort((a, b) => b[1].count - a[1].count);
    for (const [key, g] of sorted) {
      const element = key.split("||")[0];
      lines.push(`| ${esc(element)} | ${esc(g.detail)} | ${g.count} | ${Array.from(g.combos).sort().join(", ")} |`);
    }
  }

  if (skippedImages.size > 0) {
    lines.push("", "## Contrast check skipped (text sits over an image/gradient background)");
    for (const s of Array.from(skippedImages).sort()) lines.push(`- ${s}`);
  }

  return lines.join("\n") + "\n";
}

// Merges every per-test raw findings file audit-walk.spec.ts wrote (one per
// viewport/theme/project combo, since fullyParallel workers can't share an
// in-memory array) into the two permanent outputs SPEC_full_app_audit.md
// Part 2 names. Only regenerates them when this run actually included
// audit-walk.spec.ts -- an unrelated test:unit or single-spec run must never
// overwrite them with "no data".
export default function globalTeardown(): void {
  const dir = path.join(process.cwd(), "test-results", "audit-raw");
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) return;

  const findings: Finding[] = [];
  const skippedImages = new Set<string>();
  for (const f of files) {
    const raw = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as RawFile;
    findings.push(...raw.findings);
    for (const s of raw.skippedImages) skippedImages.add(s);
  }

  writeFileSync(path.join(process.cwd(), "test-results", "audit-findings.json"), JSON.stringify(findings, null, 2));
  writeFileSync(path.join(process.cwd(), "docs", "AUDIT_FINDINGS.md"), renderMarkdown(findings, skippedImages, files.length));
}
