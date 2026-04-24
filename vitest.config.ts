import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 5000,
    clearMocks: true,
    include: ["src/**/*.test.ts"],
    exclude: ["build", "node_modules"],
    coverage: {
      provider: "v8",
      exclude: ["node_modules/", "src/tests/"],
    },
  },
});
