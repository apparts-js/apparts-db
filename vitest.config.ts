import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 5000,
    clearMocks: true,
    include: ["src/**/*.test.ts"],
    exclude: ["build", "node_modules"],
    sequence: {
      // beforeAll hooks registered at file scope (e.g. the DB-create hook
      // registered inside setupTest from src/tests/pg.ts) must finish before
      // the test file's own beforeAll runs. Vitest's default ("parallel")
      // runs them concurrently via Promise.all, which races the DB creation
      // against the first CREATE TABLE.
      hooks: "list",
    },
    coverage: {
      provider: "v8",
      exclude: ["node_modules/", "src/tests/"],
    },
  },
});
