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
  },
  // Display the deployed Git revision so a cached phone build can be matched
  // directly to the source commit. Vercel supplies the SHA in production;
  // local builds read it from the current repository.
  define: {
    __GIT_COMMIT__: JSON.stringify(resolveGitCommit()),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
