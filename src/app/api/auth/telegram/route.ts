import { NextResponse } from "next/server";

import { createSession } from "@/lib/auth/session";
import { verifyTelegramAuth } from "@/lib/auth/telegram";
import { env } from "@/lib/env";
import { upsertTelegramUser } from "@/server/upsert-telegram-user";

type TelegramPayloadRecord = Record<string, string>;

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
  const payload = Object.fromEntries(searchParams.entries());
  const requestedReturnTo = searchParams.get("returnTo");

  try {
    const { returnTo } = await completeTelegramAuth(payload, requestedReturnTo);

    return NextResponse.redirect(new URL(returnTo, env.NEXT_PUBLIC_APP_URL));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "telegram-auth-failed";
    const code =
      message === "telegram-auth-claim-required" || message === "telegram-auth-conflict"
        ? "claim-required"
        : "failed";
    return NextResponse.redirect(
      new URL(`/profile?authError=${encodeURIComponent(code)}`, env.NEXT_PUBLIC_APP_URL),
    );
  }
}

export async function POST(request: Request) {
  try {
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
