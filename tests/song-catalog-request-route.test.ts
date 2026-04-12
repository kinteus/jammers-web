import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const createRequestMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const isDatabaseUnavailableErrorMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    songCatalogRequest: {
      create: createRequestMock,
    },
  },
}));

vi.mock("@/lib/prisma-errors", () => ({
  isDatabaseUnavailableError: isDatabaseUnavailableErrorMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("song catalog request route", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/song-catalog-request/route");
    const formData = new FormData();
    formData.set("eventId", "event-1");
    formData.set("artistName", "Muse");
    formData.set("trackTitle", "Hysteria");

    const response = await POST(
      new Request("http://localhost/api/song-catalog-request", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "auth-required" });
  });

  it("rejects invalid payloads before touching the database", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });

    const { POST } = await import("@/app/api/song-catalog-request/route");
    const formData = new FormData();
    formData.set("eventId", "event-1");
    formData.set("artistName", " ");
    formData.set("trackTitle", "Hysteria");

    const response = await POST(
      new Request("http://localhost/api/song-catalog-request", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    expect(createRequestMock).not.toHaveBeenCalled();
  });

  it("returns a degraded response when the database is unavailable", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    createRequestMock.mockRejectedValue(new Error("db down"));
    isDatabaseUnavailableErrorMock.mockReturnValue(true);

    const { POST } = await import("@/app/api/song-catalog-request/route");
    const formData = new FormData();
    formData.set("eventId", "event-1");
    formData.set("artistName", "Muse");
    formData.set("trackTitle", "Hysteria");

    const response = await POST(
      new Request("http://localhost/api/song-catalog-request", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "database-unavailable" });
  });

  it("creates the request and revalidates the affected pages", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    createRequestMock.mockResolvedValue({ id: "request-1" });

    const { POST } = await import("@/app/api/song-catalog-request/route");
    const formData = new FormData();
    formData.set("eventId", "event-1");
    formData.set("artistName", "Muse");
    formData.set("trackTitle", "Hysteria");
    formData.set("comment", "Please add the album version");

    const response = await POST(
      new Request("http://localhost/api/song-catalog-request", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(createRequestMock).toHaveBeenCalledWith({
      data: {
        requestedById: "user-1",
        artistName: "Muse",
        trackTitle: "Hysteria",
        comment: "Please add the album version",
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
    expect(revalidatePathMock).toHaveBeenCalledWith("/events/event-1");
  });
});
