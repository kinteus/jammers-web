import { EventStatus, TrackInviteStatus, TrackSeatStatus, UserRole } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const revalidatePathMock = vi.hoisted(() => vi.fn());
const revalidateTagMock = vi.hoisted(() => vi.fn());
const requireUserMock = vi.hoisted(() => vi.fn());
const sendTelegramInviteMessageMock = vi.hoisted(() => vi.fn());

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  trackSeat: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
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
    findUnique: vi.fn(),
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
  requireAdmin: vi.fn(),
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
  it("does not let a track proposer release another participant's seat", async () => {
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

  it("sends an invite instead of silently assigning another user to a closed optional seat", async () => {
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
          status: EventStatus.CLOSED,
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
