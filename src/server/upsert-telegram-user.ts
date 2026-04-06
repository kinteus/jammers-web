import { db } from "@/lib/db";
import { normalizeTelegramUsername } from "@/lib/auth/telegram-username";

type TelegramIdentity = {
  telegramId: string;
  telegramUsername?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

export async function upsertTelegramUser(identity: TelegramIdentity) {
  const normalizedUsername = normalizeTelegramUsername(identity.telegramUsername);
  const existing = await db.user.findFirst({
    where: {
      OR: [
        { telegramId: identity.telegramId },
        ...(normalizedUsername ? [{ telegramUsername: normalizedUsername }] : []),
      ],
    },
  });

  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: {
        telegramId: identity.telegramId,
        telegramUsername: normalizedUsername,
        fullName: identity.fullName,
        avatarUrl: identity.avatarUrl,
      },
    });
  }

  return db.user.create({
    data: {
      telegramId: identity.telegramId,
      telegramUsername: normalizedUsername,
      fullName: identity.fullName,
      avatarUrl: identity.avatarUrl,
    },
  });
}
