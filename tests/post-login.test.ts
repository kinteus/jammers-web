import { describe, expect, it, vi } from "vitest";
const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { event: { findFirst } } }));
import { getPostLoginPath } from "@/server/post-login";
describe("post-login destination", () => {
  it("selects the nearest future gig with effective open registration", async () => {
    findFirst.mockResolvedValue({ id: "next-gig" });
    expect(await getPostLoginPath()).toBe("/events/next-gig");
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        startsAt: { gte: expect.any(Date) },
        AND: [
          { OR: [{ status: "OPEN" }, { status: "DRAFT", registrationOpensAt: { lte: expect.any(Date) } }] },
          { OR: [{ registrationClosesAt: null }, { registrationClosesAt: { gt: expect.any(Date) } }] },
        ],
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }], select: { id: true },
    });
  });
  it("falls back to home", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getPostLoginPath()).toBe("/");
  });
});
