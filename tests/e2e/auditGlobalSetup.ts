import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

// Clears last run's raw per-test audit findings before a new run starts, so
// a run that doesn't include audit-walk.spec.ts never sees a stale
// leftover file and mistakes it for this run's output (auditGlobalTeardown
// only regenerates docs/AUDIT_FINDINGS.md when this directory is non-empty).
export default function globalSetup(): void {
  const dir = path.join(process.cwd(), "test-results", "audit-raw");
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
