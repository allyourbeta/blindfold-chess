/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // A short build-time stamp so a phone's build can be confirmed at a glance
  // instead of guessed at — see the footer on the menu screen.
  define: {
    __BUILD_ID__: JSON.stringify(new Date().toISOString().replace(/[-:]/g, "").slice(0, 13)),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
