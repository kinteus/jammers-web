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

  it.each([false, true])("rejects username-only legacy takeover (case-insensitive=%s)", async (insensitive) => {
    dbMock.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(insensitive ? null : { id: "legacy", telegramId: null });
    if (insensitive) dbMock.user.findFirst.mockResolvedValueOnce({ id: "legacy", telegramId: null });
    const { upsertTelegramUser, TelegramIdentityConflictError } = await import("@/server/upsert-telegram-user");
    await expect(upsertTelegramUser({ telegramId: "123", telegramUsername: "legacy" })).rejects.toBeInstanceOf(TelegramIdentityConflictError);
    expect(dbMock.user.update).not.toHaveBeenCalled();
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
