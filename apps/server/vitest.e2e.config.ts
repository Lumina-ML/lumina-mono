import { defineConfig } from "vitest/config";

/**
 * Vitest config for the E2E suite. Kept separate from the unit-test
 * config so:
 *   - `pnpm test` stays fast (no Docker dependency)
 *   - `pnpm test:e2e` can opt into long timeouts + serial execution
 *
 * `singleFork: true` is mandatory because testcontainers only starts
 * one set of containers per process; parallel workers would each try to
 * bind the same ports.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    globalSetup: ["./tests/e2e/global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    sequence: {
      hooks: "list",
    },
  },
  resolve: {
    alias: {
      "~": new URL("./src", import.meta.url).pathname,
    },
  },
});