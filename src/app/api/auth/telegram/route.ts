import { NextResponse } from "next/server";

import { createSession } from "@/lib/auth/session";
import { TelegramAuthPayload, verifyTelegramAuth } from "@/lib/auth/telegram";
import { env } from "@/lib/env";
import { consumeRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { getSafeReturnTo } from "@/lib/return-to";
import {
  TelegramIdentityConflictError,
  upsertTelegramUser,
} from "@/server/upsert-telegram-user";

type TelegramPayloadRecord = Record<string, TelegramAuthPayload[keyof TelegramAuthPayload]>;

const telegramAuthSearchParamKeys = [
  "id",
  "first_name",
  "last_name",
  "username",
  "photo_url",
  "auth_date",
  "hash",
] as const;

async function completeTelegramAuth(
  payload: TelegramPayloadRecord,
  requestedReturnTo?: string | null,
) {
  const verified = verifyTelegramAuth(payload as never);
  const user = await upsertTelegramUser(verified);

  await createSession(user.id);

  return {
    user,
    returnTo: getSafeReturnTo(requestedReturnTo),
  };
}

function getTelegramPayloadFromSearchParams(searchParams: URLSearchParams) {
  if (!searchParams.has("id") || !searchParams.has("auth_date") || !searchParams.has("hash")) {
    return null;
  }

  const payload: TelegramPayloadRecord = {};
  for (const key of telegramAuthSearchParamKeys) {
    const value = searchParams.get(key);
    if (value !== null) {
      payload[key] = value;
    }
  }

  return payload;
}

function redirectNoStore(url: URL) {
  return NextResponse.redirect(url, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedReturnTo = searchParams.get("returnTo");
  const retryUrl = new URL(
    getSafeReturnTo(requestedReturnTo),
    env.NEXT_PUBLIC_APP_URL,
  );
  retryUrl.searchParams.set("authError", "retry");

  const payload = getTelegramPayloadFromSearchParams(searchParams);
  if (!payload) {
    return redirectNoStore(retryUrl);
  }

  try {
    const { returnTo } = await completeTelegramAuth(payload, requestedReturnTo);
    const redirectUrl = new URL(returnTo, env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set("auth", String(Date.now()));

    return redirectNoStore(redirectUrl);
  } catch {
    return redirectNoStore(retryUrl);
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: `telegram-auth:${getClientIpFromHeaders(request.headers)}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many Telegram sign-in attempts. Please try again in a few minutes.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const body = (await request.json()) as {
      payload?: TelegramPayloadRecord;
      returnTo?: string;
    };

    const { returnTo } = await completeTelegramAuth(
      body.payload ?? (body as TelegramPayloadRecord),
      body.returnTo,
    );

    return NextResponse.json({
      ok: true,
      redirectTo: returnTo,
      cacheBuster: Date.now(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Telegram authentication failed.";
    const status = error instanceof TelegramIdentityConflictError ? 409 : 400;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}
