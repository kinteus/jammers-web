import { EventStatus, UserRole, UserStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const revalidatePathMock = vi.hoisted(() => vi.fn());
const revalidateTagMock = vi.hoisted(() => vi.fn());
const requireAdminMock = vi.hoisted(() => vi.fn());
const requireUserMock = vi.hoisted(() => vi.fn());

const txMock = vi.hoisted(() => ({
  eventLineupSlot: {
    findMany: vi.fn(),
  },
  setlistItem: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  track: {
    create: vi.fn(),
  },
  trackSeat: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
    callback(txMock),
  ),
  event: {
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  eventEditLock: {
    create: vi.fn(),
  },
  eventLineupSlot: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  track: {
    findFirst: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/server/auth-guards", () => ({
  requireAdmin: requireAdminMock,
  requireSuperAdmin: vi.fn(),
  requireUser: requireUserMock,
}));

vi.mock("@/server/telegram-bot", async () => {
  const actual = await vi.importActual<typeof import("@/server/telegram-bot")>(
    "@/server/telegram-bot",
  );

  return {
    ...actual,
    sendTelegramFeedbackMessage: vi.fn(),
    sendTelegramInviteMessage: vi.fn(),
    sendTelegramPublishedSetMessage: vi.fn(),
    sendTelegramSeatApprovalRequestMessage: vi.fn(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

function futureOpenEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    maxTracksPerUser: 5,
    registrationClosesAt: null,
    registrationOpensAt: null,
    slug: "testovyi-gig-56e2",
    startsAt: new Date("2099-05-01T19:30:00.000Z"),
    status: EventStatus.OPEN,
    title: "Тестовый Гиг",
    ...overrides,
  };
}

describe("event route slugs in server actions", () => {
  it(
    "creates events with ASCII route slugs for Cyrillic titles",
    async () => {
      requireAdminMock.mockResolvedValue({
        id: "admin-1",
        role: UserRole.ADMIN,
      });
      dbMock.event.create.mockResolvedValue({
        id: "event-1",
        slug: "testovyi-gig-56e2",
      });

      const { createEventAction } = await import("@/server/actions");

      await expect(
        createEventAction(
          formData({
            title: "Тестовый Гиг",
            startsAt: "2099-05-01T19:30",
            registrationOpensAt: "2099-04-01T19:30",
            registrationClosesAt: "2099-04-30T19:30",
            lineupJson: "[]",
          }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT:/admin/events/event-1");

      expect(dbMock.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: expect.stringMatching(/^testovyi-gig-[a-f0-9]{4}$/),
        }),
      });
    },
    10_000,
  );

  it("does not revalidate legacy non-ASCII event slug paths after creating a track", async () => {
    requireUserMock.mockResolvedValue({
      bans: [],
      email: null,
      fullName: "Anna",
      id: "user-1",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      telegramId: "tg-1",
      telegramUsername: "anna",
    });
    dbMock.event.findUniqueOrThrow.mockResolvedValue(
      futureOpenEvent({ slug: "тестовыи-гиг-56e2" }),
    );
    dbMock.track.findFirst.mockResolvedValue(null);
    dbMock.eventLineupSlot.findMany.mockResolvedValue([]);
    txMock.track.create.mockResolvedValue({ id: "track-1" });
    txMock.eventLineupSlot.findMany.mockResolvedValue([]);
    txMock.setlistItem.findMany.mockResolvedValue([]);
    txMock.trackSeat.findMany.mockResolvedValue([]);

    const { createTrackAction } = await import("@/server/actions");

    await expect(
      createTrackAction(
        formData({
          eventId: "event-1",
          eventSlug: "event-1",
          songId: "song-1",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/events/event-1?notice=track-created&highlightTrack=track-1#track-board",
    );

    expect(revalidatePathMock).toHaveBeenCalledWith("/events/event-1");
    expect(revalidatePathMock).not.toHaveBeenCalledWith("/events/тестовыи-гиг-56e2");
  });

  it("encodes legacy non-ASCII event slug redirects", async () => {
    requireUserMock.mockResolvedValue({
      bans: [],
      email: null,
      fullName: "Anna",
      id: "user-1",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      telegramId: "tg-1",
      telegramUsername: "anna",
    });
    dbMock.event.findUniqueOrThrow.mockResolvedValue(futureOpenEvent());
    dbMock.track.findFirst.mockResolvedValue({ id: "track-existing" });

    const { createTrackAction } = await import("@/server/actions");

    await expect(
      createTrackAction(
        formData({
          eventId: "event-1",
          eventSlug: "тестовыи-гиг-56e2",
          songId: "song-1",
        }),
      ),
    ).rejects.toThrow(
      `NEXT_REDIRECT:/events/${encodeURIComponent("тестовыи-гиг-56e2")}?error=track-exists#track-board`,
    );
  });
});
