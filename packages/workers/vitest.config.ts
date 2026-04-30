import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../.env.local") });

export default defineConfig({
  test: {
    name: "workers",
    environment: "node",
    globals: false,
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
