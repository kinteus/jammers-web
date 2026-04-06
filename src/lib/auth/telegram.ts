import crypto from "node:crypto";

import { env } from "@/lib/env";

type TelegramAuthValue = string | number | null | undefined;

export type TelegramAuthPayload = {
  id: TelegramAuthValue;
  first_name?: TelegramAuthValue;
  last_name?: TelegramAuthValue;
  username?: TelegramAuthValue;
  photo_url?: TelegramAuthValue;
  auth_date: TelegramAuthValue;
  hash: TelegramAuthValue;
};

function stringifyTelegramValue(value: TelegramAuthValue) {
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function buildDataCheckString(payload: Record<string, TelegramAuthValue>) {
  return Object.keys(payload)
    .filter((key) => key !== "hash" && payload[key] != null && payload[key] !== "")
    .sort()
    .map((key) => `${key}=${stringifyTelegramValue(payload[key])}`)
    .join("\n");
}

export function verifyTelegramAuth(payload: TelegramAuthPayload) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? env.TELEGRAM_BOT_TOKEN;
  const maxAgeSeconds = Number(
    process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS ?? env.TELEGRAM_AUTH_MAX_AGE_SECONDS,
  );

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required for Telegram auth.");
  }

  const authDate = Number(payload.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (Number.isNaN(authDate) || now - authDate > maxAgeSeconds) {
    throw new Error("Telegram auth payload expired.");
  }

  const secret = crypto
    .createHash("sha256")
    .update(botToken)
    .digest();

  const dataCheckString = buildDataCheckString(payload);
  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  const computed = Buffer.from(computedHash, "hex");
  const receivedHash = stringifyTelegramValue(payload.hash);
  const received = Buffer.from(receivedHash ?? "", "hex");

  if (computed.length !== received.length || !crypto.timingSafeEqual(computed, received)) {
    throw new Error("Invalid Telegram payload signature.");
  }

  return {
    telegramId: String(payload.id),
    telegramUsername: stringifyTelegramValue(payload.username),
    fullName:
      [stringifyTelegramValue(payload.first_name), stringifyTelegramValue(payload.last_name)]
        .filter((value): value is string => Boolean(value))
        .join(" ") || null,
    avatarUrl: stringifyTelegramValue(payload.photo_url),
  };
}
