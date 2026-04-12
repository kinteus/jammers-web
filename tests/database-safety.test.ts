import { describe, expect, it } from "vitest";

import { isLocalProductionTunnelDatabaseUrl } from "@/lib/database-safety";

describe("isLocalProductionTunnelDatabaseUrl", () => {
  it("detects the local prod tunnel pattern", () => {
    expect(
      isLocalProductionTunnelDatabaseUrl(
        "postgresql://user:pass@127.0.0.1:55432/prod",
      ),
    ).toBe(true);
  });

  it("ignores ordinary local development urls", () => {
    expect(
      isLocalProductionTunnelDatabaseUrl(
        "postgresql://postgres:postgres@localhost:5432/jammers",
      ),
    ).toBe(false);
  });
});
