import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyTelegramAuth } from "@/lib/auth/telegram";

function signPayload(payload: Record<string, string>, botToken: string) {
  const secret = crypto.createHash("sha256").update(botToken).digest();
  const dataCheckString = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join("\n");

  return crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
}

describe("verifyTelegramAuth", () => {
  it("accepts a valid payload", () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456:test-token";

    const payload = {
      auth_date: `${Math.floor(Date.now() / 1000)}`,
      first_name: "Anna",
      id: "12345678",
      photo_url: "https://example.com/a.jpg",
      username: "anna_drums",
    };

    const result = verifyTelegramAuth({
      ...payload,
      hash: signPayload(payload, process.env.TELEGRAM_BOT_TOKEN),
    });

    expect(result.telegramId).toBe("12345678");
    expect(result.telegramUsername).toBe("anna_drums");
  });

  it("rejects a tampered payload", () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456:test-token";

    expect(() =>
      verifyTelegramAuth({
        auth_date: `${Math.floor(Date.now() / 1000)}`,
        first_name: "Anna",
        id: "12345678",
        username: "anna_drums",
        hash: "invalid",
      }),
    ).toThrow(/signature/);
  });
});
