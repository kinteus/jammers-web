import { NextResponse } from "next/server";

import { createSession } from "@/lib/auth/session";
import { TelegramAuthPayload, verifyTelegramAuth } from "@/lib/auth/telegram";
import { env } from "@/lib/env";
import { consumeRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { upsertTelegramUser } from "@/server/upsert-telegram-user";

type TelegramPayloadRecord = Record<string, TelegramAuthPayload[keyof TelegramAuthPayload]>;

function getSafeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/profile";
  }

  return value;
}

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedReturnTo = searchParams.get("returnTo");

  return NextResponse.redirect(
    new URL(
      `${getSafeReturnTo(requestedReturnTo)}${requestedReturnTo?.includes("?") ? "&" : "?"}authError=retry`,
      env.NEXT_PUBLIC_APP_URL,
    ),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
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

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
