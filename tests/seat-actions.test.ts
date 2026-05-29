import { EventStatus, TrackInviteStatus, TrackSeatStatus, UserRole } from "@prisma/client";
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
const publishBoardUpdateMock = vi.hoisted(() => vi.fn());
const sendTelegramAdminSeatAssignedMessageMock = vi.hoisted(() => vi.fn());
const sendTelegramInviteMessageMock = vi.hoisted(() => vi.fn());

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  eventEditLock: {
    findMany: vi.fn(),
  },
  eventLineupSlot: {
    findMany: vi.fn(),
  },
  track: {
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  trackSeat: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  trackInvite: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
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

vi.mock("@/server/board-event-bus", () => ({
  publishBoardUpdate: publishBoardUpdateMock,
}));

vi.mock("@/server/telegram-bot", async () => {
  const actual = await vi.importActual<typeof import("@/server/telegram-bot")>(
    "@/server/telegram-bot",
  );

  return {
    ...actual,
    sendTelegramAdminSeatAssignedMessage: sendTelegramAdminSeatAssignedMessageMock,
    sendTelegramFeedbackMessage: vi.fn(),
    sendTelegramInviteMessage: sendTelegramInviteMessageMock,
    sendTelegramPublishedSetMessage: vi.fn(),
    sendTelegramSeatApprovalRequestMessage: vi.fn(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function buildFormData(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

function buildOpenEvent() {
  return {
    id: "event-1",
    maxTracksPerUser: 5,
    registrationClosesAt: null,
    registrationOpensAt: null,
    startsAt: new Date("2099-05-01T19:30:00.000Z"),
    status: EventStatus.OPEN,
    title: "Spring Jam Night",
  };
}

describe("releaseSeatInlineAction", () => {
  it(
    "does not let a track proposer release another participant's seat",
    async () => {
      requireUserMock.mockResolvedValue({
        id: "proposer-1",
        role: UserRole.USER,
      });
      dbMock.trackSeat.findUniqueOrThrow.mockResolvedValue({
        id: "seat-1",
        status: TrackSeatStatus.CLAIMED,
        userId: "player-1",
        track: {
          event: buildOpenEvent(),
          proposedById: "proposer-1",
        },
      });
      dbMock.trackSeat.updateMany.mockResolvedValue({ count: 1 });

      const { releaseSeatInlineAction } = await import("@/server/actions");
      const result = await releaseSeatInlineAction(
        buildFormData({
          eventSlug: "spring-jam-night",
          seatId: "seat-1",
        }),
      );

      expect(result).toEqual({ ok: false, error: "release-not-allowed" });
      expect(dbMock.trackSeat.updateMany).not.toHaveBeenCalled();
    },
    10_000,
  );
});

describe("adminAssignSeatAction", () => {
  it("assigns the selected registered user and sends a Telegram notification", async () => {
    requireAdminMock.mockResolvedValue({
      id: "admin-1",
      role: UserRole.ADMIN,
    });
    dbMock.eventEditLock.findMany.mockResolvedValue([
      {
        eventId: "event-1",
        userId: "admin-1",
      },
    ]);
    dbMock.trackSeat.findUniqueOrThrow.mockResolvedValue({
      id: "seat-1",
      label: "Bass",
      lineupSlot: {
        key: "bass",
      },
      trackId: "track-1",
      track: {
        event: buildOpenEvent(),
        eventId: "event-1",
        song: {
          artist: { name: "Blur" },
          title: "Song 2",
        },
      },
    });
    dbMock.user.findUniqueOrThrow.mockResolvedValue({
      fullName: "Boris Bass",
      id: "player-1",
      telegramId: "tg-player-1",
      telegramUsername: "boris_bass",
    });
    dbMock.trackSeat.findMany.mockResolvedValue([]);
    dbMock.trackSeat.update.mockResolvedValue({
      id: "seat-1",
    });
    publishBoardUpdateMock.mockResolvedValue(undefined);
    sendTelegramAdminSeatAssignedMessageMock.mockResolvedValue({
      note: "Sent",
      status: "PENDING",
    });

    const { adminAssignSeatAction } = await import("@/server/actions");

    await expect(
      adminAssignSeatAction(
        buildFormData({
          eventSlug: "spring-jam-night",
          seatId: "seat-1",
          userId: "player-1",
        }),
      ),
    ).resolves.toBeUndefined();

    expect(dbMock.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "player-1" },
    });
    expect(dbMock.trackSeat.update).toHaveBeenCalledWith({
      where: { id: "seat-1" },
      data: expect.objectContaining({
        status: TrackSeatStatus.CLAIMED,
        userId: "player-1",
      }),
    });
    expect(sendTelegramAdminSeatAssignedMessageMock).toHaveBeenCalledWith({
      eventTitle: "Spring Jam Night",
      recipientTelegramId: "tg-player-1",
      seatLabel: "Bass",
      songLabel: "Blur - Song 2",
    });
    expect(publishBoardUpdateMock).toHaveBeenCalledWith({
      eventId: "event-1",
      reason: "seat-claimed",
    });
  });
});

describe("inviteToSeatAction", () => {
  it("keeps an invite pending when Telegram delivery fails", async () => {
    requireUserMock.mockResolvedValue({
      fullName: "Anna",
      id: "proposer-1",
      role: UserRole.USER,
      telegramUsername: "anna_drums",
    });
    dbMock.trackSeat.findUniqueOrThrow.mockResolvedValue({
      id: "seat-1",
      isOptional: false,
      label: "Bass",
      status: TrackSeatStatus.OPEN,
      trackId: "track-1",
      userId: null,
      lineupSlot: {
        key: "bass",
      },
      track: {
        event: buildOpenEvent(),
        eventId: "event-1",
        proposedBy: {
          id: "proposer-1",
        },
        proposedById: "proposer-1",
        song: {
          artist: { name: "Blur" },
          title: "Song 2",
        },
      },
    });
    dbMock.user.findUnique.mockResolvedValue({
      id: "player-1",
      telegramId: null,
      telegramUsername: "boris_bass",
    });
    dbMock.trackInvite.findFirst.mockResolvedValue(null);
    sendTelegramInviteMessageMock.mockResolvedValue({
      note: "Telegram chat is not configured.",
      status: "DELIVERY_FAILED",
    });

    const { inviteToSeatAction } = await import("@/server/actions");

    await expect(
      inviteToSeatAction(
        buildFormData({
          eventSlug: "spring-jam-night",
          recipientUsername: "@boris_bass",
          seatId: "seat-1",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/events/spring-jam-night?notice=invite-saved-without-telegram#track-board",
    );

    expect(sendTelegramInviteMessageMock).toHaveBeenCalledWith({
      eventTitle: "Spring Jam Night",
      inviterLabel: "anna_drums",
      recipientTelegramId: null,
      seatLabel: "Bass",
      songLabel: "Blur - Song 2",
    });
    expect(dbMock.trackInvite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientId: "player-1",
        senderId: "proposer-1",
        status: TrackInviteStatus.PENDING,
      }),
    });
  });

  it("sends an invite instead of silently assigning another user to a published optional seat", async () => {
    requireUserMock.mockResolvedValue({
      fullName: "Anna",
      id: "proposer-1",
      role: UserRole.USER,
      telegramUsername: "anna_drums",
    });
    dbMock.trackSeat.findUniqueOrThrow.mockResolvedValue({
      id: "seat-optional-1",
      isOptional: true,
      label: "BV",
      status: TrackSeatStatus.OPEN,
      trackId: "track-1",
      userId: null,
      lineupSlot: {
        key: "backing-vocal",
      },
      track: {
        event: {
          ...buildOpenEvent(),
          status: EventStatus.PUBLISHED,
        },
        eventId: "event-1",
        proposedBy: {
          id: "proposer-1",
        },
        proposedById: "proposer-1",
        song: {
          artist: { name: "Blur" },
          title: "Tender",
        },
      },
    });
    dbMock.user.findUnique.mockResolvedValue({
      id: "player-1",
      telegramId: "tg-player-1",
      telegramUsername: "boris_bass",
    });
    dbMock.trackInvite.findFirst.mockResolvedValue(null);
    sendTelegramInviteMessageMock.mockResolvedValue({
      note: "Invite was sent through Telegram.",
      status: "PENDING",
    });

    const { inviteToSeatAction } = await import("@/server/actions");

    await expect(
      inviteToSeatAction(
        buildFormData({
          eventSlug: "spring-jam-night",
          recipientUsername: "@boris_bass",
          seatId: "seat-optional-1",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/events/spring-jam-night?notice=invite-sent#track-board",
    );

    expect(sendTelegramInviteMessageMock).toHaveBeenCalledWith({
      eventTitle: "Spring Jam Night",
      inviterLabel: "anna_drums",
      recipientTelegramId: "tg-player-1",
      seatLabel: "BV",
      songLabel: "Blur - Tender",
    });
    expect(dbMock.trackSeat.updateMany).not.toHaveBeenCalled();
    expect(dbMock.trackInvite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientId: "player-1",
        seatId: "seat-optional-1",
        senderId: "proposer-1",
        status: TrackInviteStatus.PENDING,
      }),
    });
  });

  it("uses a registered user id for inline invites instead of accepting arbitrary usernames", async () => {
    requireUserMock.mockResolvedValue({
      fullName: "Anna",
      id: "proposer-1",
      role: UserRole.USER,
      telegramUsername: "anna_drums",
    });
    dbMock.trackSeat.findUniqueOrThrow.mockResolvedValue({
      id: "seat-1",
      isOptional: false,
      label: "Bass",
      status: TrackSeatStatus.OPEN,
      trackId: "track-1",
      userId: null,
      lineupSlot: {
        key: "bass",
      },
      track: {
        event: buildOpenEvent(),
        eventId: "event-1",
        proposedBy: {
          id: "proposer-1",
        },
        proposedById: "proposer-1",
        song: {
          artist: { name: "Blur" },
          title: "Song 2",
        },
      },
    });
    dbMock.user.findUnique.mockResolvedValue({
      id: "player-1",
      telegramId: "tg-player-1",
      telegramUsername: "boris_bass",
    });
    dbMock.trackInvite.findFirst.mockResolvedValue(null);
    sendTelegramInviteMessageMock.mockResolvedValue({
      note: "Invite was sent through Telegram.",
      status: "PENDING",
    });

    const { inviteToSeatInlineAction } = await import("@/server/actions");

    await expect(
      inviteToSeatInlineAction(
        buildFormData({
          eventSlug: "spring-jam-night",
          recipientUserId: "player-1",
          recipientUsername: "made_up_user",
          seatId: "seat-1",
        }),
      ),
    ).resolves.toEqual({ ok: true, notice: "invite-sent" });

    expect(dbMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "player-1" },
    });
  });
});

describe("respondToInviteAction", () => {
  it("redirects to profile feedback instead of throwing when accepting would exceed the track limit", async () => {
    dbMock.trackInvite.findUniqueOrThrow.mockReset();
    dbMock.trackSeat.findMany.mockReset();
    dbMock.trackSeat.count.mockReset();
    requireUserMock.mockResolvedValue({
      id: "player-1",
      role: UserRole.USER,
      telegramUsername: "player_one",
    });
    dbMock.trackInvite.findUniqueOrThrow.mockResolvedValueOnce({
      id: "invite-1",
      recipientId: "player-1",
      deliveryNote: null,
      trackId: "track-new",
      track: {
        eventId: "event-1",
      },
      seat: {
        id: "seat-new",
        label: "Bass",
        status: TrackSeatStatus.OPEN,
        userId: null,
        lineupSlot: {
          key: "bass",
        },
        track: {
          event: {
            ...buildOpenEvent(),
            maxTracksPerUser: 3,
          },
        },
      },
    });
    dbMock.trackSeat.findMany.mockResolvedValue([
      { trackId: "track-1" },
      { trackId: "track-2" },
      { trackId: "track-3" },
    ]);
    dbMock.trackSeat.count.mockResolvedValueOnce(0);

    const { respondToInviteAction } = await import("@/server/actions");

    await expect(
      respondToInviteAction(
        buildFormData({
          decision: "accept",
          eventSlug: "event-1",
          inviteId: "invite-1",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/profile?inviteError=track-limit#invitations");
  });

  it("returns a track-limit error for inline invite responses instead of redirecting", async () => {
    dbMock.trackInvite.findUniqueOrThrow.mockReset();
    dbMock.trackSeat.findMany.mockReset();
    dbMock.trackSeat.count.mockReset();
    requireUserMock.mockResolvedValue({
      id: "player-1",
      role: UserRole.USER,
      telegramUsername: "player_one",
    });
    dbMock.trackInvite.findUniqueOrThrow.mockResolvedValueOnce({
      id: "invite-1",
      recipientId: "player-1",
      deliveryNote: null,
      trackId: "track-new",
      track: {
        eventId: "event-1",
      },
      seat: {
        id: "seat-new",
        label: "Bass",
        status: TrackSeatStatus.OPEN,
        userId: null,
        lineupSlot: {
          key: "bass",
        },
        track: {
          event: {
            ...buildOpenEvent(),
            maxTracksPerUser: 3,
          },
        },
      },
    });
    dbMock.trackSeat.findMany.mockResolvedValue([
      { trackId: "track-1" },
      { trackId: "track-2" },
      { trackId: "track-3" },
    ]);
    dbMock.trackSeat.count.mockResolvedValueOnce(0);

    const { respondToInviteInlineAction } = await import("@/server/actions");

    await expect(
      respondToInviteInlineAction(
        buildFormData({
          decision: "accept",
          eventSlug: "event-1",
          inviteId: "invite-1",
        }),
      ),
    ).resolves.toEqual({ ok: false, error: "track-limit" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("updateTrackArrangementAction", () => {
  function arrangementFormData(overrides: Record<string, string | string[]>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(overrides)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          formData.append(key, entry);
        }
      } else {
        formData.set(key, value);
      }
    }
    return formData;
  }

  function setupArrangementMocks() {
    dbMock.$transaction.mockImplementation(
      async (callback: (tx: typeof dbMock) => Promise<unknown>) => callback(dbMock),
    );
    dbMock.eventLineupSlot.findMany.mockResolvedValue([
      {
        allowOptional: true,
        displayOrder: 1,
        id: "slot-vocals",
        key: "vocals",
        label: "Vocals",
        seatCount: 2,
      },
    ]);
    dbMock.track.update.mockResolvedValue({ id: "track-1" });
    dbMock.trackSeat.update.mockResolvedValue({ id: "seat" });
    dbMock.trackSeat.findMany.mockResolvedValue([]);
    dbMock.user.findMany.mockResolvedValue([]);
  }

  it("does not let a proposer change a seat held by another participant", async () => {
    requireUserMock.mockResolvedValue({
      id: "proposer-1",
      role: UserRole.USER,
      telegramUsername: "proposer",
    });
    setupArrangementMocks();
    dbMock.track.findUniqueOrThrow.mockResolvedValue({
      id: "track-1",
      proposedById: "proposer-1",
      songId: "song-1",
      eventId: "event-1",
      event: buildOpenEvent(),
      seats: [
        {
          id: "seat-vocals-1",
          label: "Vocals",
          seatIndex: 1,
          status: TrackSeatStatus.CLAIMED,
          isOptional: false,
          userId: "proposer-1",
          claimedAt: new Date(),
          lineupSlot: { key: "vocals" },
        },
        {
          id: "seat-vocals-2",
          label: "Vocals",
          seatIndex: 2,
          status: TrackSeatStatus.CLAIMED,
          isOptional: false,
          userId: "other-user",
          claimedAt: new Date(),
          lineupSlot: { key: "vocals" },
        },
      ],
    });

    const { updateTrackArrangementAction } = await import("@/server/actions");

    await expect(
      updateTrackArrangementAction(
        arrangementFormData({
          trackId: "track-1",
          eventSlug: "event-1",
          claimSeatKeys: ["Vocals:1"],
          unavailableSeatKeys: ["Vocals:2"],
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:");

    // The other participant's seat must be left untouched.
    expect(dbMock.trackSeat.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "seat-vocals-2" } }),
    );
    // The proposer's own claimed seat is reaffirmed.
    expect(dbMock.trackSeat.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "seat-vocals-1" } }),
    );
  });

  it("lets an admin release a seat held by another participant", async () => {
    requireUserMock.mockResolvedValue({
      id: "admin-1",
      role: UserRole.ADMIN,
      telegramUsername: "admin",
    });
    setupArrangementMocks();
    dbMock.track.findUniqueOrThrow.mockResolvedValue({
      id: "track-1",
      proposedById: "proposer-1",
      songId: "song-1",
      eventId: "event-1",
      event: buildOpenEvent(),
      seats: [
        {
          id: "seat-vocals-1",
          label: "Vocals",
          seatIndex: 1,
          status: TrackSeatStatus.CLAIMED,
          isOptional: false,
          userId: "other-user",
          claimedAt: new Date(),
          lineupSlot: { key: "vocals" },
        },
        {
          id: "seat-vocals-2",
          label: "Vocals",
          seatIndex: 2,
          status: TrackSeatStatus.OPEN,
          isOptional: false,
          userId: null,
          claimedAt: null,
          lineupSlot: { key: "vocals" },
        },
      ],
    });

    const { updateTrackArrangementAction } = await import("@/server/actions");

    await expect(
      updateTrackArrangementAction(
        arrangementFormData({
          trackId: "track-1",
          eventSlug: "event-1",
          unavailableSeatKeys: ["Vocals:1"],
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/event-1?notice=track-updated");

    expect(dbMock.trackSeat.update).toHaveBeenCalledWith({
      where: { id: "seat-vocals-1" },
      data: {
        userId: null,
        status: TrackSeatStatus.UNAVAILABLE,
        claimedAt: null,
        isOptional: false,
      },
    });
  });
});
