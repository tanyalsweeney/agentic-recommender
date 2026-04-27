import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/shared/vitest.config.ts",
  "packages/agents/vitest.config.ts",
  "packages/evals/vitest.config.ts",
]);
