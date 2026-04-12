import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

const isDatabaseUnavailableErrorMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/prisma-errors", () => ({
  isDatabaseUnavailableError: isDatabaseUnavailableErrorMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("isDatabaseAvailable", () => {
  it("returns true when the probe query succeeds", async () => {
    dbMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const { isDatabaseAvailable } = await import("@/server/database-health");

    await expect(isDatabaseAvailable()).resolves.toBe(true);
  });

  it("returns false for recognized database connectivity failures", async () => {
    const error = new Error("db offline");
    dbMock.$queryRaw.mockRejectedValue(error);
    isDatabaseUnavailableErrorMock.mockReturnValue(true);

    const { isDatabaseAvailable } = await import("@/server/database-health");

    await expect(isDatabaseAvailable()).resolves.toBe(false);
  });

  it("rethrows unexpected probe errors", async () => {
    const error = new Error("boom");
    dbMock.$queryRaw.mockRejectedValue(error);
    isDatabaseUnavailableErrorMock.mockReturnValue(false);

    const { isDatabaseAvailable } = await import("@/server/database-health");

    await expect(isDatabaseAvailable()).rejects.toThrow("boom");
  });
});
