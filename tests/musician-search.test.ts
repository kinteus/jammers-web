import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), findMany: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/db", () => ({ db: { user: { findMany: mocks.findMany } } }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rateLimit }));
import { GET } from "@/app/api/musician-search/route";
const search = (q: string) => GET(new Request(`http://localhost/api/musician-search?q=${encodeURIComponent(q)}`));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "sender", status: "ACTIVE" });
  mocks.rateLimit.mockReturnValue({ allowed: true });
  mocks.findMany.mockResolvedValue([{ id: "anna", fullName: "Anna", telegramUsername: "anna_drums" }]);
});
describe("musician search", () => {
  it("never lists the directory for empty or short queries", async () => {
    for (const query of ["", "a", " @an ", "x".repeat(81)]) {
      expect(await (await search(query)).json()).toEqual({ users: [] });
    }
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("requires an active signed-in user", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await search("anna")).status).toBe(401);
    mocks.user.mockResolvedValue({ id: "suspended", status: "SUSPENDED" });
    expect((await search("anna")).status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("searches account and name case-insensitively and caps the response", async () => {
    const response = await search(" @Anna ");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ users: [{ id: "anna" }] });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ACTIVE", OR: [
        { telegramUsername: { contains: "Anna", mode: "insensitive" } },
        { fullName: { contains: "Anna", mode: "insensitive" } },
      ] },
      take: 8, select: { id: true, fullName: true, telegramUsername: true },
    }));
  });
  it("rate limits lookup attempts", async () => {
    mocks.rateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 20 });
    const response = await search("anna");
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("20");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
