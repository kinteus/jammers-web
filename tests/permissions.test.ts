import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { hasActiveBan, isAdmin } from "@/lib/permissions";

describe("permissions helpers", () => {
  it("recognizes admin users", () => {
    expect(isAdmin({ role: UserRole.ADMIN })).toBe(true);
    expect(isAdmin({ role: UserRole.USER })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("detects active bans and ignores expired bans", () => {
    expect(
      hasActiveBan({
        status: "ACTIVE",
        bans: [
          {
            isPermanent: true,
            endsAt: null,
          },
        ],
      }),
    ).toBe(true);

    expect(
      hasActiveBan({
        status: "ACTIVE",
        bans: [
          {
            isPermanent: false,
            endsAt: new Date(Date.now() + 60_000),
          },
        ],
      }),
    ).toBe(true);

    expect(
      hasActiveBan({
        status: "ACTIVE",
        bans: [
          {
            isPermanent: false,
            endsAt: new Date(Date.now() - 60_000),
          },
        ],
      }),
    ).toBe(false);
  });
});
