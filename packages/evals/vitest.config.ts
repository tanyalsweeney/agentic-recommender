import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../.env.local") });

// Default log path for eval runs — override via AGENT_CALL_LOG in .env.local.
process.env.AGENT_CALL_LOG ??= resolve(__dirname, "logs/agent-calls.csv");

export default defineConfig({
  test: {
    name: "evals",
    environment: "node",
    globals: false,
    include: ["src/**/*.eval.ts"],
    // Evals make real Anthropic API calls — run manually only, never in CI.
    // Use: pnpm eval:skeptic (etc) to run specific suites.
    testTimeout: 240_000,
    hookTimeout: 600_000,
  },
});
