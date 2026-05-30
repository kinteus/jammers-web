import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe("upsertTelegramUser", () => {
  it("updates an existing user matched by telegram id", async () => {
    dbMock.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      telegramUsername: "anna_old",
    });
    dbMock.user.update.mockResolvedValue({
      id: "user-1",
      telegramId: "tg-1",
      telegramUsername: "anna_drums",
    });

    const { upsertTelegramUser } = await import("@/server/upsert-telegram-user");

    await expect(
      upsertTelegramUser({
        telegramId: "tg-1",
        telegramUsername: "@Anna_Drums",
        fullName: "Anna",
      }),
    ).resolves.toMatchObject({
      id: "user-1",
      telegramUsername: "anna_drums",
    });

    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        telegramId: "tg-1",
        telegramUsername: "anna_drums",
        fullName: "Anna",
        avatarUrl: undefined,
      },
    });
  });

  it("preserves an existing username when Telegram omits it on a later sign-in", async () => {
    dbMock.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      telegramUsername: "samokryl",
    });
    dbMock.user.update.mockResolvedValue({
      id: "user-1",
      telegramId: "tg-1",
      telegramUsername: "samokryl",
    });

    const { upsertTelegramUser } = await import("@/server/upsert-telegram-user");

    await expect(
      upsertTelegramUser({
        telegramId: "tg-1",
        fullName: "Aleksandr Krylov",
      }),
    ).resolves.toMatchObject({
      id: "user-1",
      telegramUsername: "samokryl",
    });

    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        telegramId: "tg-1",
        telegramUsername: "samokryl",
        fullName: "Aleksandr Krylov",
        avatarUrl: undefined,
      },
    });
  });

  it("rejects linking a new telegram id to an existing username", async () => {
    dbMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "conflicting-user", telegramId: "tg-old" });

    const { TelegramIdentityConflictError, upsertTelegramUser } = await import(
      "@/server/upsert-telegram-user"
    );

    await expect(
      upsertTelegramUser({
        telegramId: "tg-new",
        telegramUsername: "@Anna_Drums",
      }),
    ).rejects.toBeInstanceOf(TelegramIdentityConflictError);

    expect(dbMock.user.create).not.toHaveBeenCalled();
  });

  it("links an imported user matched case-insensitively by username", async () => {
    dbMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    dbMock.user.findFirst.mockResolvedValueOnce({ id: "legacy-user", telegramId: null });
    dbMock.user.update.mockResolvedValue({
      id: "legacy-user",
      telegramId: "tg-kyle",
      telegramUsername: "kyle_reese",
      fullName: "Kyle Reese",
    });

    const { upsertTelegramUser } = await import("@/server/upsert-telegram-user");

    await expect(
      upsertTelegramUser({
        telegramId: "tg-kyle",
        telegramUsername: "@Kyle_Reese",
        fullName: "Kyle Reese",
      }),
    ).resolves.toMatchObject({
      id: "legacy-user",
      telegramId: "tg-kyle",
    });

    expect(dbMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        telegramUsername: {
          equals: "kyle_reese",
          mode: "insensitive",
        },
      },
      select: { id: true, telegramId: true },
    });
  });

  it("links an imported user matched by username when telegram id is still empty", async () => {
    dbMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "legacy-user", telegramId: null });
    dbMock.user.update.mockResolvedValue({
      id: "legacy-user",
      telegramId: "tg-new",
      telegramUsername: "disentinel",
      fullName: "Disentinel",
    });

    const { upsertTelegramUser } = await import("@/server/upsert-telegram-user");

    await expect(
      upsertTelegramUser({
        telegramId: "tg-new",
        telegramUsername: "@Disentinel",
        fullName: "Disentinel",
      }),
    ).resolves.toMatchObject({
      id: "legacy-user",
      telegramId: "tg-new",
      telegramUsername: "disentinel",
    });

    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "legacy-user" },
      data: {
        telegramId: "tg-new",
        telegramUsername: "disentinel",
        fullName: "Disentinel",
        avatarUrl: undefined,
      },
    });
    expect(dbMock.user.create).not.toHaveBeenCalled();
  });

  it("creates a normalized user record when there is no conflict", async () => {
    dbMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    dbMock.user.create.mockResolvedValue({
      id: "user-2",
      telegramId: "tg-2",
      telegramUsername: "boris_bass",
    });

    const { upsertTelegramUser } = await import("@/server/upsert-telegram-user");

    await expect(
      upsertTelegramUser({
        telegramId: "tg-2",
        telegramUsername: "  @Boris_Bass ",
        fullName: "Boris",
      }),
    ).resolves.toMatchObject({
      id: "user-2",
      telegramUsername: "boris_bass",
    });

    expect(dbMock.user.create).toHaveBeenCalledWith({
      data: {
        telegramId: "tg-2",
        telegramUsername: "boris_bass",
        fullName: "Boris",
        avatarUrl: undefined,
      },
    });
  });

  it("creates a new user without a username when Telegram did not provide one", async () => {
    dbMock.user.findUnique.mockResolvedValueOnce(null);
    dbMock.user.create.mockResolvedValue({
      id: "user-no-username",
      telegramId: "tg-no-username",
      telegramUsername: null,
    });

    const { upsertTelegramUser } = await import("@/server/upsert-telegram-user");

    await expect(
      upsertTelegramUser({
        telegramId: "tg-no-username",
        fullName: "Aleksandr Krylov",
      }),
    ).resolves.toMatchObject({
      id: "user-no-username",
      telegramUsername: null,
    });

    expect(dbMock.user.findFirst).not.toHaveBeenCalled();
    expect(dbMock.user.create).toHaveBeenCalledWith({
      data: {
        telegramId: "tg-no-username",
        telegramUsername: null,
        fullName: "Aleksandr Krylov",
        avatarUrl: undefined,
      },
    });
  });
});
