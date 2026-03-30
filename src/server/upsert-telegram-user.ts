import { db } from "@/lib/db";

type TelegramIdentity = {
  telegramId: string;
  telegramUsername?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

export async function upsertTelegramUser(identity: TelegramIdentity) {
  const existing = await db.user.findFirst({
    where: {
      OR: [
        { telegramId: identity.telegramId },
        ...(identity.telegramUsername
          ? [{ telegramUsername: identity.telegramUsername }]
          : []),
      ],
    },
  });

  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: {
        telegramId: identity.telegramId,
        telegramUsername: identity.telegramUsername,
        fullName: identity.fullName,
        avatarUrl: identity.avatarUrl,
      },
    });
  }

  return db.user.create({
    data: {
      telegramId: identity.telegramId,
      telegramUsername: identity.telegramUsername,
      fullName: identity.fullName,
      avatarUrl: identity.avatarUrl,
    },
  });
}
