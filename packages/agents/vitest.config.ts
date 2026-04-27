import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "agents",
    environment: "node",
    globals: false,
  },
});
