import { db } from "@/lib/db";
import { normalizeTelegramUsername } from "@/lib/auth/telegram-username";

export class TelegramIdentityConflictError extends Error {
  constructor() {
    super("This Telegram account cannot be linked automatically. Please contact an admin.");
  }
}

type TelegramIdentity = {
  telegramId: string;
  telegramUsername?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

export async function upsertTelegramUser(identity: TelegramIdentity) {
  const normalizedUsername = normalizeTelegramUsername(identity.telegramUsername);
  const existing = await db.user.findUnique({
    where: {
      telegramId: identity.telegramId,
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

  if (normalizedUsername) {
    const conflictingUser = await db.user.findUnique({
      where: { telegramUsername: normalizedUsername },
      select: { id: true },
    });

    if (conflictingUser) {
      throw new TelegramIdentityConflictError();
    }
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
