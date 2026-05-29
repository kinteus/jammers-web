import { describe, expect, it } from "vitest";

import {
  isValidTelegramUsername,
  normalizeTelegramUsername,
} from "@/lib/auth/telegram-username";

describe("normalizeTelegramUsername", () => {
  it("normalizes usernames into lowercase handle strings", () => {
    expect(normalizeTelegramUsername("  @@Anna_Drums ")).toBe("anna_drums");
  });

  it("returns null for blank input", () => {
    expect(normalizeTelegramUsername(" @ ")).toBeNull();
    expect(normalizeTelegramUsername(null)).toBeNull();
  });
});

describe("isValidTelegramUsername", () => {
  it("accepts valid Telegram handles", () => {
    expect(isValidTelegramUsername("@Anna_Drums")).toBe(true);
    expect(isValidTelegramUsername("boris99")).toBe(true);
  });

  it("rejects too-short, empty, or malformed handles", () => {
    expect(isValidTelegramUsername("ab")).toBe(false);
    expect(isValidTelegramUsername("1abcd")).toBe(false);
    expect(isValidTelegramUsername("has space")).toBe(false);
    expect(isValidTelegramUsername(null)).toBe(false);
  });
});
