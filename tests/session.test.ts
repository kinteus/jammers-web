import { afterEach, describe, expect, it, vi } from "vitest";

const cookieStoreMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

const headerStoreMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  authSession: {
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const isDatabaseUnavailableErrorMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStoreMock),
  headers: vi.fn(async () => headerStoreMock),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "test",
    SESSION_SECRET: "local-development-session-secret",
    SESSION_TTL_HOURS: 168,
    SESSION_COOKIE_NAME: "jammers_session",
  },
}));

vi.mock("@/lib/prisma-errors", () => ({
  isDatabaseUnavailableError: isDatabaseUnavailableErrorMock,
}));

afterEach(() => {
  vi.clearAllMocks();
  cookieStoreMock.get.mockReset();
  cookieStoreMock.set.mockReset();
  cookieStoreMock.delete.mockReset();
  headerStoreMock.get.mockReset();
});

describe("session helpers", () => {
  it("creates a session record and cookie", async () => {
    headerStoreMock.get.mockImplementation((name: string) => {
      if (name === "user-agent") {
        return "vitest";
      }

      if (name === "x-real-ip") {
        return "127.0.0.1";
      }

      return null;
    });

    const { createSession } = await import("@/lib/auth/session");

    await createSession("user-1");

    expect(dbMock.authSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(dbMock.authSession.create).toHaveBeenCalledTimes(1);
    expect(cookieStoreMock.set).toHaveBeenCalledTimes(1);
  });

  it("returns null when there is no session cookie", async () => {
    cookieStoreMock.get.mockReturnValue(undefined);

    const { getSessionUser } = await import("@/lib/auth/session");

    await expect(getSessionUser()).resolves.toBeNull();
    expect(dbMock.authSession.findUnique).not.toHaveBeenCalled();
  });

  it("deletes expired sessions and returns null", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "raw-token" });
    dbMock.authSession.findUnique.mockResolvedValue({
      id: "session-1",
      expiresAt: new Date(Date.now() - 1_000),
      lastSeenAt: new Date(Date.now() - 100_000),
      user: { id: "user-1" },
    });

    const { getSessionUser } = await import("@/lib/auth/session");

    await expect(getSessionUser()).resolves.toBeNull();
    expect(dbMock.authSession.delete).toHaveBeenCalledWith({
      where: { id: "session-1" },
    });
  });

  it("returns null when the database is temporarily unavailable", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "raw-token" });
    dbMock.authSession.findUnique.mockRejectedValue(new Error("db offline"));
    isDatabaseUnavailableErrorMock.mockReturnValue(true);

    const { getSessionUser } = await import("@/lib/auth/session");

    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("returns the signed-in user and refreshes lastSeen when stale", async () => {
    const now = Date.now();
    cookieStoreMock.get.mockReturnValue({ value: "raw-token" });
    dbMock.authSession.findUnique.mockResolvedValue({
      id: "session-2",
      expiresAt: new Date(now + 60_000),
      lastSeenAt: new Date(now - 16 * 60 * 1000),
      user: { id: "user-2", telegramUsername: "anna" },
    });

    const { getSessionUser } = await import("@/lib/auth/session");

    await expect(getSessionUser()).resolves.toMatchObject({
      id: "user-2",
      telegramUsername: "anna",
    });
    expect(dbMock.authSession.updateMany).toHaveBeenCalledTimes(1);
  });

  it("deletes the current session cookie and db row on sign-out", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "raw-token" });

    const { deleteSession } = await import("@/lib/auth/session");

    await deleteSession();

    expect(dbMock.authSession.deleteMany).toHaveBeenCalledTimes(1);
    expect(cookieStoreMock.delete).toHaveBeenCalledWith("jammers_session");
  });
});
