import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/**/*.ts",
        "src/server/telegram-bot.ts",
        "src/server/published-set-notifications.ts",
      ],
      exclude: [
        "src/lib/db.ts",
        "src/lib/env.ts",
        "src/lib/i18n-server.ts",
      ],
    },
  },
});
