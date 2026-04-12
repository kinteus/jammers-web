import { afterEach, describe, expect, it, vi } from "vitest";

const isDatabaseAvailableMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/database-health", () => ({
  isDatabaseAvailable: isDatabaseAvailableMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("health routes", () => {
  it("returns 200 from readiness when the database is available", async () => {
    isDatabaseAvailableMock.mockResolvedValue(true);

    const { GET } = await import("@/app/api/healthz/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      databaseAvailable: true,
      service: "jammers-web",
    });
  });

  it("returns 503 from readiness when the database is unavailable", async () => {
    isDatabaseAvailableMock.mockResolvedValue(false);

    const { GET } = await import("@/app/api/healthz/route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      databaseAvailable: false,
    });
  });

  it("returns 200 from liveness without probing the database", async () => {
    const { GET } = await import("@/app/api/livez/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      service: "jammers-web",
    });
    expect(isDatabaseAvailableMock).not.toHaveBeenCalled();
  });
});
