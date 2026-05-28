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
  event: {
    delete: vi.fn(),
  },
  eventEditLock: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  eventLineupSlot: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  selectionRun: {
    deleteMany: vi.fn(),
  },
  setlistItem: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  track: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  trackInvite: {
    deleteMany: vi.fn(),
  },
  trackSeat: {
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
    callback(txMock),
  ),
  $executeRaw: vi.fn(),
  event: {
    create: vi.fn(),
    delete: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  trackSeat: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  trackInvite: {
    create: vi.fn(),
  },
  eventEditLock: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  eventLineupSlot: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  track: {
    findFirst: vi.fn(),
  },
  setlistItem: {
    findMany: vi.fn(),
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
    minParticipantsPerTrack: 1,
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
    "deletes an event with a short cascade path instead of a long interactive transaction",
    async () => {
      requireAdminMock.mockResolvedValue({
        id: "admin-1",
        role: UserRole.ADMIN,
      });
      dbMock.event.delete.mockResolvedValue({ id: "event-1" });

      const { deleteEventAction } = await import("@/server/actions");

      await expect(
        deleteEventAction(
          formData({
            eventId: "event-1",
            eventSlug: "spring-jam-night",
          }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT:/admin?notice=event-deleted");

      expect(dbMock.$transaction).not.toHaveBeenCalled();
      expect(dbMock.trackSeat.deleteMany).toHaveBeenCalledWith({
        where: {
          track: {
            eventId: "event-1",
          },
        },
      });
      expect(dbMock.event.delete).toHaveBeenCalledWith({
        where: { id: "event-1" },
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
    },
    10_000,
  );

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

  it("redirects back to the admin event with a saved notice after updating event settings", async () => {
    requireAdminMock.mockResolvedValue({
      id: "admin-1",
      role: UserRole.ADMIN,
    });
    dbMock.eventEditLock.findMany.mockResolvedValue([]);
    dbMock.event.findUniqueOrThrow.mockResolvedValue({
      id: "event-1",
      maxSetDurationMinutes: 15,
      maxTracksPerUser: 3,
      minParticipantsPerTrack: 1,
      tracks: [],
    });
    dbMock.event.update.mockResolvedValue({ id: "event-1" });

    const { updateEventAction } = await import("@/server/actions");

    await expect(
      updateEventAction(
        formData({
          eventId: "event-1",
          eventSlug: "spring-jam-night",
          title: "Spring Jam",
          startsAt: "2099-05-01T19:30",
          registrationOpensAt: "2099-04-01T19:30",
          registrationClosesAt: "2099-04-30T19:30",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/admin/events/spring-jam-night?notice=event-saved");

    expect(dbMock.event.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({
        title: "Spring Jam",
      }),
    });
  });

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

  it("creates proposed track seats in bulk with their final state", async () => {
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
    dbMock.track.findFirst.mockResolvedValue(null);
    dbMock.trackSeat.findMany.mockResolvedValue([]);
    dbMock.eventLineupSlot.findMany.mockResolvedValue([
      {
        allowOptional: true,
        displayOrder: 1,
        id: "slot-guitar",
        key: "guitar",
        label: "Guitar",
        seatCount: 2,
      },
      {
        allowOptional: false,
        displayOrder: 2,
        id: "slot-drums",
        key: "drums",
        label: "Drums",
        seatCount: 1,
      },
    ]);
    txMock.track.create.mockResolvedValue({ id: "track-1" });
    txMock.setlistItem.findMany.mockResolvedValue([]);
    txMock.trackSeat.createMany.mockResolvedValue({ count: 3 });

    const { createTrackAction } = await import("@/server/actions");

    await expect(
      createTrackAction(
        formData({
          claimSeatKeys: "Guitar 1:1",
          eventId: "event-1",
          eventSlug: "spring-jam-night",
          optionalSeatKeys: "Guitar 2:2",
          songId: "song-1",
          unavailableSeatKeys: "Drums:1",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/events/event-1?notice=track-created&highlightTrack=track-1#track-board",
    );

    expect(txMock.trackSeat.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          claimedAt: expect.any(Date),
          isOptional: false,
          label: "Guitar 1",
          lineupSlotId: "slot-guitar",
          seatIndex: 1,
          status: "CLAIMED",
          trackId: "track-1",
          userId: "user-1",
        }),
        expect.objectContaining({
          claimedAt: null,
          isOptional: true,
          label: "Guitar 2",
          lineupSlotId: "slot-guitar",
          seatIndex: 2,
          status: "OPEN",
          trackId: "track-1",
          userId: null,
        }),
        expect.objectContaining({
          claimedAt: null,
          isOptional: false,
          label: "Drums",
          lineupSlotId: "slot-drums",
          seatIndex: 1,
          status: "UNAVAILABLE",
          trackId: "track-1",
          userId: null,
        }),
      ],
    });
    expect(txMock.trackSeat.update).not.toHaveBeenCalled();
  });

  it("creates pending invites selected while proposing a track", async () => {
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
    dbMock.track.findFirst.mockResolvedValue(null);
    dbMock.eventLineupSlot.findMany.mockResolvedValue([
      {
        allowOptional: true,
        displayOrder: 1,
        id: "slot-guitar",
        key: "guitar",
        label: "Guitar",
        seatCount: 1,
      },
      {
        allowOptional: false,
        displayOrder: 2,
        id: "slot-drums",
        key: "drums",
        label: "Drums",
        seatCount: 1,
      },
    ]);
    txMock.track.create.mockResolvedValue({ id: "track-1" });
    txMock.setlistItem.findMany.mockResolvedValue([]);
    txMock.trackSeat.createMany.mockResolvedValue({ count: 2 });
    dbMock.trackSeat.findMany.mockResolvedValue([
      {
        id: "seat-guitar",
        label: "Guitar",
        seatIndex: 1,
        trackId: "track-1",
        track: {
          event: { title: "Spring Jam" },
          song: {
            title: "Song 2",
            artist: { name: "Blur" },
          },
        },
      },
    ]);
    dbMock.user.findMany.mockResolvedValue([
      {
        id: "user-2",
        telegramId: "tg-2",
      },
    ]);
    const { sendTelegramInviteMessage } = await import("@/server/telegram-bot");
    vi.mocked(sendTelegramInviteMessage).mockResolvedValue({
      note: "sent",
      status: "PENDING",
    });

    const { createTrackAction } = await import("@/server/actions");

    await expect(
      createTrackAction(
        formData({
          eventId: "event-1",
          eventSlug: "spring-jam-night",
          inviteSeatRequests: "Guitar:1|user-2",
          songId: "song-1",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/events/event-1?notice=track-created&highlightTrack=track-1#track-board",
    );

    expect(dbMock.trackInvite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientId: "user-2",
        seatId: "seat-guitar",
        senderId: "user-1",
        status: "PENDING",
        trackId: "track-1",
      }),
    });
    expect(sendTelegramInviteMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientTelegramId: "tg-2",
        seatLabel: "Guitar",
      }),
    );
  });

  it("rejects track proposals whose required positions are below the event minimum", async () => {
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
      futureOpenEvent({ minParticipantsPerTrack: 2 }),
    );
    dbMock.track.findFirst.mockResolvedValue(null);
    dbMock.eventLineupSlot.findMany.mockResolvedValue([
      {
        allowOptional: true,
        displayOrder: 1,
        id: "slot-guitar",
        key: "guitar",
        label: "Guitar",
        seatCount: 1,
      },
      {
        allowOptional: true,
        displayOrder: 2,
        id: "slot-vocal",
        key: "vocal",
        label: "Vocal",
        seatCount: 1,
      },
    ]);

    const { createTrackAction } = await import("@/server/actions");

    await expect(
      createTrackAction(
        formData({
          eventId: "event-1",
          eventSlug: "spring-jam-night",
          optionalSeatKeys: "Vocal:1",
          songId: "song-1",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/events/spring-jam-night?error=min-required-seats#track-board",
    );

    expect(txMock.track.create).not.toHaveBeenCalled();
  });

  it("refuses to move incomplete setlist items into the main set", async () => {
    requireAdminMock.mockResolvedValue({
      id: "admin-1",
      role: UserRole.ADMIN,
    });
    dbMock.eventEditLock.findMany.mockResolvedValue([{ userId: "admin-1" }]);
    dbMock.event.findUniqueOrThrow.mockResolvedValue(
      futureOpenEvent({ minParticipantsPerTrack: 2 }),
    );
    dbMock.setlistItem.findMany.mockResolvedValue([
      {
        editedById: null,
        eventId: "event-1",
        id: "item-1",
        orderIndex: 1,
        section: "BACKLOG",
        trackId: "track-1",
        track: {
          seats: [
            {
              isOptional: false,
              status: "CLAIMED",
              userId: "user-1",
            },
            {
              isOptional: false,
              status: "OPEN",
              userId: null,
            },
          ],
        },
      },
    ]);

    const { moveSetlistItemAction } = await import("@/server/actions");

    await expect(
      moveSetlistItemAction(
        formData({
          eventId: "event-1",
          eventSlug: "spring-jam-night",
          itemId: "item-1",
          orderIndex: "1",
          section: "MAIN",
        }),
      ),
    ).rejects.toThrow("Only fully assembled tracks can be moved into the main set.");

    expect(txMock.setlistItem.update).not.toHaveBeenCalled();
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
