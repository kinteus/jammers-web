import { describe, expect, it } from "vitest";

import { parseAdminLocalDateTimeInput } from "@/lib/domain/local-datetime";

describe("parseAdminLocalDateTimeInput", () => {
  it("keeps the admin browser wall time by applying the submitted timezone offset", () => {
    expect(
      parseAdminLocalDateTimeInput("2026-05-01T19:30", "Starts at", -180).toISOString(),
    ).toBe("2026-05-01T16:30:00.000Z");
  });

  it("falls back to regular Date parsing when the browser offset is missing", () => {
    expect(
      parseAdminLocalDateTimeInput("2026-05-01T19:30Z", "Starts at", null).toISOString(),
    ).toBe("2026-05-01T19:30:00.000Z");
  });
});
