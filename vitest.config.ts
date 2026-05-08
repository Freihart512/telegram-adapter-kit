import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/contract/**/*.test.ts"],
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: ["src/core/**/*.ts", "src/errors/**/*.ts"],
    },
  },
});
