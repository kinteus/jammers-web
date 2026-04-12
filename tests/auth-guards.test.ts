import { UserRole } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const isSuperAdminUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/lib/auth/admin-access", () => ({
  isSuperAdminUser: isSuperAdminUserMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("auth guards", () => {
  it("requires an authenticated user", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const { requireUser } = await import("@/server/auth-guards");

    await expect(requireUser()).rejects.toThrow("Authentication required.");
  });

  it("blocks banned users", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-1",
      role: UserRole.USER,
      status: "ACTIVE",
      bans: [
        {
          isPermanent: true,
          endsAt: null,
        },
      ],
    });

    const { requireUser } = await import("@/server/auth-guards");

    await expect(requireUser()).rejects.toThrow("This account is currently banned.");
  });

  it("requires the admin role for admin entrypoints", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-2",
      role: UserRole.USER,
      status: "ACTIVE",
      bans: [],
    });

    const { requireAdmin } = await import("@/server/auth-guards");

    await expect(requireAdmin()).rejects.toThrow("Admin access required.");
  });

  it("requires primary-admin status for super-admin entrypoints", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-3",
      role: UserRole.ADMIN,
      status: "ACTIVE",
      bans: [],
    });
    isSuperAdminUserMock.mockReturnValue(false);

    const { requireSuperAdmin } = await import("@/server/auth-guards");

    await expect(requireSuperAdmin()).rejects.toThrow(
      "Only the primary admin can manage the admin list.",
    );
  });

  it("returns the admin user for primary-admin requests", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-4",
      role: UserRole.ADMIN,
      status: "ACTIVE",
      bans: [],
    });
    isSuperAdminUserMock.mockReturnValue(true);

    const { requireSuperAdmin } = await import("@/server/auth-guards");

    await expect(requireSuperAdmin()).resolves.toMatchObject({
      id: "user-4",
      role: UserRole.ADMIN,
    });
  });
});
