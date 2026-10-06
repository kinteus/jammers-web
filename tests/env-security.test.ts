import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it("cannot enable development impersonation in a production build", async () => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:55439/jammers_security");
  vi.stubEnv("SESSION_SECRET", "security-audit-local-only-secret");
  vi.stubEnv("ENABLE_DEV_AUTH", "true");
  const { env } = await import("@/lib/env");
  expect(env.ENABLE_DEV_AUTH).toBe(false);
});
