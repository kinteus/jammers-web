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
  const existingByTelegramId = await db.user.findUnique({
    where: { telegramId: identity.telegramId },
  });

  if (existingByTelegramId) {
    return db.user.update({
      where: { id: existingByTelegramId.id },
      data: {
        telegramId: identity.telegramId,
        telegramUsername: normalizedUsername,
        fullName: identity.fullName,
        avatarUrl: identity.avatarUrl,
      },
    });
  }

  const existingByUsername = normalizedUsername
    ? await db.user.findUnique({
        where: { telegramUsername: normalizedUsername },
      })
    : null;

  if (existingByUsername) {
    if (existingByUsername.telegramId) {
      throw new Error("telegram-auth-conflict");
    }

    throw new Error("telegram-auth-claim-required");
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
