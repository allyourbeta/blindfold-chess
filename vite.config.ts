/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

function resolveGitCommit(): string {
  const deploymentCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (deploymentCommit) return deploymentCommit.slice(0, 7);

  try {
    return execSync("git rev-parse --short=7 HEAD", {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // onnxruntime-web's default "bundle" build self-locates its wasm binary
    // via import.meta.url, which makes Vite copy its own extra ~13MB copy
    // into dist/assets on top of the one we deliberately self-host at
    // public/maia/ort/ (see maia.worker.ts). This condition picks the
    // non-bundle build instead, which expects `ort.env.wasm.wasmPaths` to be
    // set (which it is) and skips the redundant copy.
    conditions: ["onnxruntime-web-use-extern-wasm"],
  },
  build: {
    rollupOptions: {
      // maia-spike.html is a standalone lab-bench page (SPEC_maia_spike.md),
      // not wired into the app — it needs its own entry to be built at all.
      input: {
        main: path.resolve(__dirname, "index.html"),
        maiaSpike: path.resolve(__dirname, "maia-spike.html"),
      },
    },
  },
  // Display the deployed Git revision so a cached phone build can be matched
  // directly to the source commit. Vercel supplies the SHA in production;
  // local builds read it from the current repository.
  define: {
    __GIT_COMMIT__: JSON.stringify(resolveGitCommit()),
    // Build moment in Pacific time, stamped at build time so the footer
    // shows when this deployment was actually produced.
    __BUILD_TIME__: JSON.stringify(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date()) + " PT",
    ),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
