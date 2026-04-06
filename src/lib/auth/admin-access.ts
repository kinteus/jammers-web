import { env } from "@/lib/env";
import { normalizeTelegramUsername } from "@/lib/auth/telegram-username";

export function isSuperAdminUser(user: { telegramUsername: string | null } | null | undefined) {
  return (
    normalizeTelegramUsername(user?.telegramUsername) ===
    normalizeTelegramUsername(env.DEFAULT_ADMIN_USERNAME)
  );
}
