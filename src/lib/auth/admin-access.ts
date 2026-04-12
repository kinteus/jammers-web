import { env } from "@/lib/env";
import { normalizeTelegramUsername } from "@/lib/auth/telegram-username";

export function isSuperAdminUser(
  user: { telegramId: string | null; telegramUsername: string | null } | null | undefined,
) {
  if (env.PRIMARY_ADMIN_TELEGRAM_ID) {
    return user?.telegramId === env.PRIMARY_ADMIN_TELEGRAM_ID;
  }

  if (env.NODE_ENV === "production") {
    return false;
  }

  return normalizeTelegramUsername(user?.telegramUsername) === normalizeTelegramUsername(env.DEFAULT_ADMIN_USERNAME);
}
