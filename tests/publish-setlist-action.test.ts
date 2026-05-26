import { EventStatus, SetlistSection, TrackSeatStatus, UserRole } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
}));
const revalidatePathMock = vi.hoisted(() => vi.fn());
const revalidateTagMock = vi.hoisted(() => vi.fn());
const requireAdminMock = vi.hoisted(() => vi.fn());
const sendTelegramPublishedSetMessageMock = vi.hoisted(() => vi.fn());

const dbMock = vi.hoisted(() => ({
  eventEditLock: {
    findMany: vi.fn(),
  },
  event: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
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
  requireUser: vi.fn(),
}));

vi.mock("@/server/telegram-bot", async () => {
  const actual = await vi.importActual<typeof import("@/server/telegram-bot")>(
    "@/server/telegram-bot",
  );

  return {
    ...actual,
    sendTelegramPublishedSetMessage: sendTelegramPublishedSetMessageMock,
    sendTelegramFeedbackMessage: vi.fn(),
    sendTelegramInviteMessage: vi.fn(),
    sendTelegramSeatApprovalRequestMessage: vi.fn(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function buildFormData() {
  const formData = new FormData();
  formData.set("eventId", "event-1");
  formData.set("eventSlug", "spring-jam-night");
  return formData;
}

function buildPublishedEvent() {
  return {
    id: "event-1",
    status: EventStatus.CLOSED,
    title: "Spring Jam Night",
    startsAt: new Date("2026-05-01T19:30:00.000Z"),
    setlistItems: [
      {
        id: "setlist-1",
        section: SetlistSection.MAIN,
        orderIndex: 1,
        track: {
          id: "track-1",
          song: {
            artist: { name: "Blur" },
            title: "Song 2",
          },
          seats: [
            {
              id: "seat-1",
              label: "Drums",
              status: TrackSeatStatus.CLAIMED,
              userId: "user-1",
              user: {
                id: "user-1",
                telegramId: "tg-1",
              },
            },
          ],
        },
      },
    ],
  };
}

describe("publishSetlistAction", () => {
  it(
    "publishes the set and fans out Telegram notifications",
    async () => {
    requireAdminMock.mockResolvedValue({
      id: "admin-1",
      role: UserRole.ADMIN,
    });
    dbMock.eventEditLock.findMany.mockResolvedValue([
      {
        eventId: "event-1",
        userId: "admin-1",
        scope: "admin-curation",
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    dbMock.event.findUniqueOrThrow.mockResolvedValue(buildPublishedEvent());
    dbMock.event.update.mockResolvedValue({
      id: "event-1",
      status: EventStatus.PUBLISHED,
    });
    sendTelegramPublishedSetMessageMock.mockResolvedValue({
      status: "PENDING",
      note: "sent",
    });

    const { publishSetlistAction } = await import("@/server/actions");

      await expect(publishSetlistAction(buildFormData())).resolves.toBeUndefined();

      expect(dbMock.event.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: { status: EventStatus.PUBLISHED },
      });
      expect(sendTelegramPublishedSetMessageMock).toHaveBeenCalledTimes(1);
      expect(revalidatePathMock).toHaveBeenCalledWith("/");
      expect(revalidatePathMock).toHaveBeenCalledWith("/events/spring-jam-night");
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/events/spring-jam-night");
    },
    10_000,
  );

  it("redirects admins to a warning when at least one notification fails", async () => {
    requireAdminMock.mockResolvedValue({
      id: "admin-1",
      role: UserRole.ADMIN,
    });
    dbMock.eventEditLock.findMany.mockResolvedValue([
      {
        eventId: "event-1",
        userId: "admin-1",
        scope: "admin-curation",
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    dbMock.event.findUniqueOrThrow.mockResolvedValue(buildPublishedEvent());
    dbMock.event.update.mockResolvedValue({
      id: "event-1",
      status: EventStatus.PUBLISHED,
    });
    sendTelegramPublishedSetMessageMock.mockResolvedValue({
      status: "DELIVERY_FAILED",
      note: "chat missing",
    });

    const { publishSetlistAction } = await import("@/server/actions");

    await expect(publishSetlistAction(buildFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/admin/events/spring-jam-night?notice=publish-partial-notify",
    );
  });
});
