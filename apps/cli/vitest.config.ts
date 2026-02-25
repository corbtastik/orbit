import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 10_000,
    // Enable module mocking for ESM
    deps: {
      interopDefault: true,
    },
    // Mock server for external modules
    server: {
      deps: {
        inline: ["@modelcontextprotocol/sdk"],
      },
    },
  },
});
