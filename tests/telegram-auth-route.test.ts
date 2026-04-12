import { afterEach, describe, expect, it, vi } from "vitest";

const createSessionMock = vi.hoisted(() => vi.fn());
const verifyTelegramAuthMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const getClientIpFromHeadersMock = vi.hoisted(() => vi.fn());
const upsertTelegramUserMock = vi.hoisted(() => vi.fn());

class MockTelegramIdentityConflictError extends Error {}

vi.mock("@/lib/auth/session", () => ({
  createSession: createSessionMock,
}));

vi.mock("@/lib/auth/telegram", () => ({
  verifyTelegramAuth: verifyTelegramAuthMock,
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://thejammers.org",
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  getClientIpFromHeaders: getClientIpFromHeadersMock,
}));

vi.mock("@/server/upsert-telegram-user", () => ({
  TelegramIdentityConflictError: MockTelegramIdentityConflictError,
  upsertTelegramUser: upsertTelegramUserMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("telegram auth route", () => {
  it("redirects unsafe GET return targets back to profile", async () => {
    const { GET } = await import("@/app/api/auth/telegram/route");

    const response = await GET(
      new Request("https://thejammers.org/api/auth/telegram?returnTo=https://evil.example"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://thejammers.org/profile?authError=retry",
    );
  });

  it("returns 429 when rate-limited", async () => {
    consumeRateLimitMock.mockReturnValue({
      allowed: false,
      retryAfterSeconds: 120,
    });
    getClientIpFromHeadersMock.mockReturnValue("127.0.0.1");

    const { POST } = await import("@/app/api/auth/telegram/route");
    const response = await POST(
      new Request("https://thejammers.org/api/auth/telegram", {
        method: "POST",
        body: JSON.stringify({ payload: {} }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
    });
  });

  it("returns 409 for Telegram identity conflicts", async () => {
    consumeRateLimitMock.mockReturnValue({
      allowed: true,
    });
    getClientIpFromHeadersMock.mockReturnValue("127.0.0.1");
    verifyTelegramAuthMock.mockReturnValue({
      telegramId: "tg-1",
      telegramUsername: "anna",
    });
    upsertTelegramUserMock.mockRejectedValue(new MockTelegramIdentityConflictError("conflict"));

    const { POST } = await import("@/app/api/auth/telegram/route");
    const response = await POST(
      new Request("https://thejammers.org/api/auth/telegram", {
        method: "POST",
        body: JSON.stringify({
          payload: {
            id: "tg-1",
            auth_date: `${Math.floor(Date.now() / 1000)}`,
            hash: "hash",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "conflict",
    });
  });

  it("creates a session and returns a safe redirect on success", async () => {
    consumeRateLimitMock.mockReturnValue({
      allowed: true,
    });
    getClientIpFromHeadersMock.mockReturnValue("127.0.0.1");
    verifyTelegramAuthMock.mockReturnValue({
      telegramId: "tg-1",
      telegramUsername: "anna",
    });
    upsertTelegramUserMock.mockResolvedValue({
      id: "user-1",
    });

    const { POST } = await import("@/app/api/auth/telegram/route");
    const response = await POST(
      new Request("https://thejammers.org/api/auth/telegram", {
        method: "POST",
        body: JSON.stringify({
          payload: {
            id: "tg-1",
            auth_date: `${Math.floor(Date.now() / 1000)}`,
            hash: "hash",
          },
          returnTo: "//evil.example",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      redirectTo: "/profile",
    });
    expect(createSessionMock).toHaveBeenCalledWith("user-1");
  });
});
