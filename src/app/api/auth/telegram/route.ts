import { NextResponse } from "next/server";

import { createSession } from "@/lib/auth/session";
import { verifyTelegramAuth } from "@/lib/auth/telegram";
import { env } from "@/lib/env";
import { upsertTelegramUser } from "@/server/upsert-telegram-user";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const payload = Object.fromEntries(searchParams.entries());

  try {
    const verified = verifyTelegramAuth(payload as never);
    const user = await upsertTelegramUser(verified);

    await createSession(user.id);
    return NextResponse.redirect(new URL("/profile", env.NEXT_PUBLIC_APP_URL));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Telegram authentication failed.";
    return NextResponse.redirect(
      new URL(`/profile?authError=${encodeURIComponent(message)}`, env.NEXT_PUBLIC_APP_URL),
    );
  }
}
