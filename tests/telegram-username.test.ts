import { describe, expect, it } from "vitest";

import { normalizeTelegramUsername } from "@/lib/auth/telegram-username";

describe("normalizeTelegramUsername", () => {
  it("normalizes usernames into lowercase handle strings", () => {
    expect(normalizeTelegramUsername("  @@Anna_Drums ")).toBe("anna_drums");
  });

  it("returns null for blank input", () => {
    expect(normalizeTelegramUsername(" @ ")).toBeNull();
    expect(normalizeTelegramUsername(null)).toBeNull();
  });
});
