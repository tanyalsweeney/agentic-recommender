import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../.env.local") });

export default defineConfig({
  test: {
    name: "agents",
    environment: "node",
    globals: false,
  },
});
