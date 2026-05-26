import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3001);
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/jammers";

export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { outputFolder: "output/playwright/report" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: process.env.SESSION_SECRET ?? "local-development-session-secret",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? `http://127.0.0.1:${port}`,
      ENABLE_DEV_AUTH: process.env.ENABLE_DEV_AUTH ?? "true",
      DEFAULT_ADMIN_USERNAME: process.env.DEFAULT_ADMIN_USERNAME ?? "kinteus",
      NODE_ENV: "production",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
