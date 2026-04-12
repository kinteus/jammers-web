import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("upsertTelegramUser", () => {
  it("updates an existing user matched by telegram id", async () => {
    dbMock.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
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

  it("rejects linking a new telegram id to an existing username", async () => {
    dbMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "conflicting-user" });

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
});
