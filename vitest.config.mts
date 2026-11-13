import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig.json: "@/lib/x" → "src/lib/x"
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    // Solo pruebas unitarias; las E2E (Playwright) irán en tests/e2e en la fase F7.
    include: ["tests/unit/**/*.test.ts"],
  },
});
