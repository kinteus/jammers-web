import crypto from "node:crypto";

import { env } from "@/lib/env";

export type TelegramAuthPayload = {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
};

function buildDataCheckString(payload: Record<string, string>) {
  return Object.keys(payload)
    .filter((key) => key !== "hash" && payload[key])
    .sort()
    .map((key) => `${key}=${payload[key]}`)
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
  const received = Buffer.from(payload.hash, "hex");

  if (computed.length !== received.length || !crypto.timingSafeEqual(computed, received)) {
    throw new Error("Invalid Telegram payload signature.");
  }

  return {
    telegramId: payload.id,
    telegramUsername: payload.username,
    fullName: [payload.first_name, payload.last_name].filter(Boolean).join(" ") || null,
    avatarUrl: payload.photo_url ?? null,
  };
}
