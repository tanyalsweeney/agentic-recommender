import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "evals",
    environment: "node",
    globals: false,
    // Evals make real Anthropic API calls — run manually only, never in CI.
    // Use: pnpm eval:skeptic (etc) to run specific suites.
    testTimeout: 60_000,
  },
});
