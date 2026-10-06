import { defineConfig, devices } from "@playwright/test";

// Deliberately disconnected database: these tests must never mutate production.
export default defineConfig({
  testDir: "./tests/smoke",
  testMatch: "security.smoke.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3019", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npx next start --hostname 127.0.0.1 --port 3019",
    url: "http://127.0.0.1:3019/api/livez",
    reuseExistingServer: false,
    env: {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55439/jammers_security?connect_timeout=1",
      SESSION_SECRET: "security-audit-local-only-secret",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3019",
      ENABLE_DEV_AUTH: "false",
    },
  },
});
