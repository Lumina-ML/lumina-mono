import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    setupFiles: ["tests/setup.ts"],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      "~": new URL("./src", import.meta.url).pathname,
    },
  },
});