import { afterEach, describe, expect, it, vi } from "vitest";

async function loadAdminAccess(envOverride: {
  NODE_ENV: "development" | "test" | "production";
  PRIMARY_ADMIN_TELEGRAM_ID?: string;
  DEFAULT_ADMIN_USERNAME: string;
}) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: envOverride,
  }));

  return import("@/lib/auth/admin-access");
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unmock("@/lib/env");
});

describe("isSuperAdminUser", () => {
  it("prefers immutable telegram id when configured", async () => {
    const { isSuperAdminUser } = await loadAdminAccess({
      NODE_ENV: "production",
      PRIMARY_ADMIN_TELEGRAM_ID: "tg-primary",
      DEFAULT_ADMIN_USERNAME: "kinteus",
    });

    expect(
      isSuperAdminUser({
        telegramId: "tg-primary",
        telegramUsername: "someone_else",
      }),
    ).toBe(true);
    expect(
      isSuperAdminUser({
        telegramId: "tg-other",
        telegramUsername: "kinteus",
      }),
    ).toBe(false);
  });

  it("does not fall back to username matching in production", async () => {
    const { isSuperAdminUser } = await loadAdminAccess({
      NODE_ENV: "production",
      DEFAULT_ADMIN_USERNAME: "kinteus",
    });

    expect(
      isSuperAdminUser({
        telegramId: null,
        telegramUsername: "kinteus",
      }),
    ).toBe(false);
  });

  it("falls back to normalized username outside production", async () => {
    const { isSuperAdminUser } = await loadAdminAccess({
      NODE_ENV: "development",
      DEFAULT_ADMIN_USERNAME: "kinteus",
    });

    expect(
      isSuperAdminUser({
        telegramId: null,
        telegramUsername: "@Kinteus",
      }),
    ).toBe(true);
  });
});
