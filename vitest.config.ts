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
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      thresholds: {
        statements: 60,
        branches: 70,
        functions: 65,
        lines: 60,
      },
      include: [
        "src/lib/**/*.ts",
        "src/lib/auth/admin-access.ts",
        "src/lib/auth/session.ts",
        "src/lib/permissions.ts",
        "src/server/database-health.ts",
        "src/server/telegram-bot.ts",
        "src/server/published-set-notifications.ts",
        "src/server/upsert-telegram-user.ts",
        "src/app/api/auth/telegram/route.ts",
        "src/app/api/healthz/route.ts",
        "src/app/api/livez/route.ts",
      ],
      exclude: [
        "src/lib/db.ts",
        "src/lib/env.ts",
        "src/lib/i18n-server.ts",
      ],
    },
  },
});
