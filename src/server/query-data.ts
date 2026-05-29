import { cache } from "react";

import { EventStatus, SetlistSection, TrackSeatStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { FAQ_PAGE_DATA_TAG } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { buildArchiveStats, buildUserArchiveStats } from "@/lib/domain/archive-stats";
import {
  getAutoSyncedEventStatus,
  getEffectiveEventStatus,
} from "@/lib/domain/event-status";
import { buildEventSlugLookupCandidates } from "@/lib/event-slugs";
import {
  DEFAULT_COMMUNITY_QUOTES_DESKTOP_DISPLAY_LIMIT,
  DEFAULT_COMMUNITY_QUOTES_MOBILE_DISPLAY_LIMIT,
  DEFAULT_LINEUP_DETAILS_MARKDOWN,
  DEFAULT_PARTICIPATION_RULES_MARKDOWN,
  SITE_CONTENT_ID,
  parseVideoUrls,
} from "@/lib/site-content";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";
import { env } from "@/lib/env";
import {
  sendTelegramBoardClosedChannelMessage,
  sendTelegramBoardClosedParticipantMessage,
} from "@/server/telegram-bot";
import { publishBoardUpdate } from "@/server/board-event-bus";

const EVENT_STATUS_SYNC_INTERVAL_MS = 30_000;

const archiveUserSelect = {
  id: true,
  telegramUsername: true,
  fullName: true,
} as const;

let lastEventStatusSyncAt = 0;
let eventStatusSyncPromise: Promise<void> | null = null;

function getEventWorkspaceInclude() {
  return {
    lineupSlots: {
      include: { instrument: true },
      orderBy: { displayOrder: "asc" as const },
    },
    tracks: {
      where: { state: "ACTIVE" as const },
      include: {
        song: {
          include: { artist: true },
        },
        proposedBy: {
          select: archiveUserSelect,
        },
        seats: {
          include: {
            user: {
              select: archiveUserSelect,
            },
            lineupSlot: true,
            invites: {
              where: {
                status: "PENDING" as const,
              },
              include: {
                recipient: {
                  select: archiveUserSelect,
                },
                sender: {
                  select: archiveUserSelect,
                },
              },
            },
          },
          orderBy: [{ lineupSlot: { displayOrder: "asc" as const } }, { seatIndex: "asc" as const }],
        },
      },
      orderBy: { createdAt: "asc" as const },
    },
    setlistItems: {
      include: {
        track: {
          include: {
            song: {
              include: { artist: true },
            },
            seats: {
              include: {
                user: {
                  select: archiveUserSelect,
                },
                lineupSlot: true,
              },
            },
          },
        },
      },
      orderBy: [{ section: "asc" as const }, { orderIndex: "asc" as const }],
    },
    editLocks: {
      where: { expiresAt: { gt: new Date() } },
      include: {
        user: {
          select: archiveUserSelect,
        },
      },
    },
  };
}

async function runDateDrivenEventStatusSync() {
  if (env.LIVE_PRODUCTION_TUNNEL) {
    return;
  }

  const now = new Date();
  const events = await db.event.findMany({
    where: {
      status: {
        in: [EventStatus.DRAFT, EventStatus.OPEN, EventStatus.PUBLISHED],
      },
      OR: [
        { registrationOpensAt: { not: null, lte: now } },
        { registrationClosesAt: { not: null, lte: now } },
        { startsAt: { lte: now } },
      ],
    },
    select: {
      id: true,
      status: true,
      startsAt: true,
      title: true,
      venueName: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      tracks: {
        where: { state: "ACTIVE" },
        select: {
          seats: {
            where: {
              status: TrackSeatStatus.CLAIMED,
              userId: { not: null },
            },
            select: {
              user: {
                select: {
                  id: true,
                  telegramId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const updates = events
    .map((event) => ({
      id: event.id,
      nextStatus: getAutoSyncedEventStatus(event),
    }))
    .filter(
      (event): event is { id: string; nextStatus: EventStatus } => event.nextStatus !== null,
    );

  if (updates.length === 0) {
    return;
  }

  for (const update of updates) {
    const event = events.find((item) => item.id === update.id);
    if (!event) {
      continue;
    }

    const result = await db.event.updateMany({
      where: {
        id: update.id,
        status: event.status,
      },
      data: { status: update.nextStatus },
    });
    if (result.count === 0) {
      continue;
    }

    if (update.nextStatus === EventStatus.CLOSED) {
      const recipients = new Map<string, string | null>();
      for (const track of event.tracks) {
        for (const seat of track.seats) {
          if (seat.user) {
            recipients.set(seat.user.id, seat.user.telegramId);
          }
        }
      }

      await Promise.allSettled([
        sendTelegramBoardClosedChannelMessage({
          channelChatId: env.TELEGRAM_CHANNEL_CHAT_ID,
          city: env.DEFAULT_EVENT_CITY,
          eventStartsAt: event.startsAt,
          venueName: event.venueName,
        }),
        ...[...recipients.values()].map((recipientTelegramId) =>
          sendTelegramBoardClosedParticipantMessage({
            eventStartsAt: event.startsAt,
            eventTitle: event.title,
            recipientTelegramId,
          }),
        ),
      ]);
    }

    await publishBoardUpdate({
      eventId: update.id,
      reason: "event-status",
    }).catch(() => {});
  }
}

async function syncDateDrivenEventStatuses() {
  const now = Date.now();
  if (now - lastEventStatusSyncAt < EVENT_STATUS_SYNC_INTERVAL_MS) {
    return;
  }

  if (!eventStatusSyncPromise) {
    eventStatusSyncPromise = (async () => {
      await runDateDrivenEventStatusSync();
      lastEventStatusSyncAt = Date.now();
    })().finally(() => {
      eventStatusSyncPromise = null;
    });
  }

  await eventStatusSyncPromise;
}

export async function getHomePageData() {
    await syncDateDrivenEventStatuses();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [events, communityQuotes, archiveEvents, content] = await Promise.all([
      db.event.findMany({
        where: {
          AND: [
            { status: { not: EventStatus.ARCHIVED } },
            {
              OR: [{ status: { not: EventStatus.PUBLISHED } }, { startsAt: { gte: today } }],
            },
          ],
        },
        include: {
          tracks: {
            where: { state: "ACTIVE" },
            include: {
              seats: {
                select: {
                  status: true,
                  isOptional: true,
                  userId: true,
                },
              },
            },
          },
        },
        orderBy: { startsAt: "desc" },
      }),
      db.communityQuote.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      }),
      db.event.findMany({
        where: {
          status: { in: [EventStatus.PUBLISHED, EventStatus.ARCHIVED] },
          startsAt: { lt: now },
        },
        include: {
          setlistItems: {
            where: { section: SetlistSection.MAIN },
            orderBy: { orderIndex: "asc" },
            include: {
              track: {
                include: {
                  proposedBy: {
                    select: archiveUserSelect,
                  },
                  song: {
                    include: { artist: true },
                  },
                  seats: {
                    include: {
                      user: {
                        select: archiveUserSelect,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { startsAt: "desc" },
      }),
      db.sitePageContent.findUnique({
        where: { id: SITE_CONTENT_ID },
        select: {
          communityQuotesDesktopDisplayLimit: true,
          communityQuotesMobileDisplayLimit: true,
        },
      }),
    ]);

    return {
      events: events.map((event) => ({
        ...event,
        effectiveStatus: getEffectiveEventStatus(event),
        participantCount: new Set(
          event.tracks.flatMap((track) =>
            track.seats
              .filter((seat) => seat.status === TrackSeatStatus.CLAIMED)
              .map((seat) => seat.userId),
          ),
        ).size,
        trackCount: event.tracks.length,
        completedTrackCount: event.tracks.filter((track) =>
          getTrackCompletionSummary(track.seats).isComplete,
        ).length,
      })),
      communityQuotes,
      communityQuotesDesktopDisplayLimit:
        content?.communityQuotesDesktopDisplayLimit ??
        DEFAULT_COMMUNITY_QUOTES_DESKTOP_DISPLAY_LIMIT,
      communityQuotesMobileDisplayLimit:
        content?.communityQuotesMobileDisplayLimit ??
        DEFAULT_COMMUNITY_QUOTES_MOBILE_DISPLAY_LIMIT,
      publishedEvents: archiveEvents.slice(0, 5),
      archiveStats: buildArchiveStats(archiveEvents),
    };
}

export async function getArchivePageData() {
  await syncDateDrivenEventStatuses();
  const now = new Date();
  const archiveEvents = await db.event.findMany({
    where: {
      status: { in: [EventStatus.PUBLISHED, EventStatus.ARCHIVED] },
      startsAt: { lt: now },
    },
    include: {
      setlistItems: {
        where: { section: SetlistSection.MAIN },
        orderBy: { orderIndex: "asc" },
        include: {
          track: {
            include: {
              proposedBy: {
                select: archiveUserSelect,
              },
              song: {
                include: { artist: true },
              },
              seats: {
                include: {
                  user: {
                    select: archiveUserSelect,
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { startsAt: "desc" },
  });

  return {
    archiveStats: buildArchiveStats(archiveEvents),
    publishedEvents: archiveEvents,
  };
}

export const getEventWorkspace = cache(async function getEventWorkspace(slug: string) {
  await syncDateDrivenEventStatuses();
  const directMatch = await db.event.findUnique({
    where: { id: slug },
    include: getEventWorkspaceInclude(),
  });

  if (directMatch) {
    return directMatch;
  }

  return db.event.findFirst({
    where: { slug: { in: buildEventSlugLookupCandidates(slug) } },
    include: getEventWorkspaceInclude(),
  });
});

export async function getAdminDashboardData() {
  await syncDateDrivenEventStatuses();
  const [events, users, songRequests, groups, artists, communityQuotes] = await Promise.all([
    db.event.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        lineupSlots: true,
        tracks: {
          where: { state: "ACTIVE" },
        },
      },
    }),
    db.user.findMany({
      include: {
        bans: {
          where: {
            OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
          },
        },
        ratingsReceived: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.songCatalogRequest.findMany({
      include: { requestedBy: true },
      orderBy: { createdAt: "desc" },
    }),
    db.ensembleGroup.findMany({
      include: {
        members: {
          include: { user: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.artist.findMany({
      include: {
        songs: true,
      },
      orderBy: { name: "asc" },
    }),
    db.communityQuote.findMany({
      include: {
        createdBy: {
          select: archiveUserSelect,
        },
        updatedBy: {
          select: archiveUserSelect,
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    events,
    users,
    songRequests,
    groups,
    artists,
    communityQuotes,
  };
}

export async function getProfileWorkspace(userId: string) {
  await syncDateDrivenEventStatuses();
  const now = new Date();
  const [profile, archiveEvents] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: {
        instruments: {
          include: { instrument: true },
        },
        trackSeats: {
          where: {
            status: TrackSeatStatus.CLAIMED,
            track: {
              state: "ACTIVE",
              event: {
                AND: [
                  { status: { not: EventStatus.ARCHIVED } },
                  {
                    OR: [{ status: { not: EventStatus.PUBLISHED } }, { startsAt: { gte: now } }],
                  },
                ],
              },
            },
          },
          include: {
            track: {
              include: {
                event: true,
                song: {
                  include: { artist: true },
                },
                seats: {
                  include: {
                    user: {
                      select: archiveUserSelect,
                    },
                    lineupSlot: true,
                  },
                },
              },
            },
          },
          orderBy: { claimedAt: "desc" },
        },
        invitations: {
          where: {
            status: "PENDING",
            track: {
              event: {
                AND: [
                  { status: { not: EventStatus.ARCHIVED } },
                  {
                    OR: [{ status: { not: EventStatus.PUBLISHED } }, { startsAt: { gte: now } }],
                  },
                ],
              },
            },
          },
          include: {
            track: {
              include: {
                event: true,
                song: {
                  include: { artist: true },
                },
              },
            },
            seat: true,
            sender: {
              select: archiveUserSelect,
            },
          },
          orderBy: { createdAt: "desc" },
        },
        invitationsSent: {
          where: {
            status: "PENDING",
            track: {
              event: {
                AND: [
                  { status: { not: EventStatus.ARCHIVED } },
                  {
                    OR: [{ status: { not: EventStatus.PUBLISHED } }, { startsAt: { gte: now } }],
                  },
                ],
              },
            },
          },
          include: {
            track: {
              include: {
                event: true,
                song: {
                  include: { artist: true },
                },
              },
            },
            seat: true,
            recipient: {
              select: archiveUserSelect,
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.event.findMany({
      where: {
        status: { in: [EventStatus.PUBLISHED, EventStatus.ARCHIVED] },
        setlistItems: {
          some: {
            track: {
              OR: [
                { proposedById: userId },
                {
                  seats: {
                    some: {
                      userId,
                      status: TrackSeatStatus.CLAIMED,
                    },
                  },
                },
              ],
            },
          },
        },
      },
      include: {
        setlistItems: {
          where: { section: SetlistSection.MAIN },
          orderBy: { orderIndex: "asc" },
          include: {
            track: {
              include: {
                proposedBy: {
                  select: archiveUserSelect,
                },
                song: {
                  include: { artist: true },
                },
                seats: {
                  include: {
                    user: {
                      select: archiveUserSelect,
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { startsAt: "desc" },
    }),
  ]);

  if (!profile) {
    return null;
  }

  return {
    ...profile,
    archiveStats: buildUserArchiveStats(archiveEvents, userId),
  };
}

export async function getInviteableUsers() {
  return db.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ telegramUsername: { not: null } }, { fullName: { not: null } }],
    },
    select: {
      id: true,
      telegramUsername: true,
      fullName: true,
    },
    orderBy: [{ telegramUsername: "asc" }, { fullName: "asc" }],
  });
}

const getCachedFaqPageData = unstable_cache(
  async () => {
    try {
      const content = await db.sitePageContent.findUnique({
        where: { id: SITE_CONTENT_ID },
      });

      return {
        participationRulesMarkdown:
          content?.participationRulesMarkdown ?? DEFAULT_PARTICIPATION_RULES_MARKDOWN,
        lineupDetailsMarkdown: content?.lineupDetailsMarkdown ?? DEFAULT_LINEUP_DETAILS_MARKDOWN,
        faqContentJson: content?.faqContentJson ?? null,
        lineupVideoUrls: parseVideoUrls(content?.lineupVideoUrlsJson),
        communityQuotesDesktopDisplayLimit:
          content?.communityQuotesDesktopDisplayLimit ??
          DEFAULT_COMMUNITY_QUOTES_DESKTOP_DISPLAY_LIMIT,
        communityQuotesMobileDisplayLimit:
          content?.communityQuotesMobileDisplayLimit ??
          DEFAULT_COMMUNITY_QUOTES_MOBILE_DISPLAY_LIMIT,
      };
    } catch {
      return {
        participationRulesMarkdown: DEFAULT_PARTICIPATION_RULES_MARKDOWN,
        lineupDetailsMarkdown: DEFAULT_LINEUP_DETAILS_MARKDOWN,
        faqContentJson: null as string | null,
        lineupVideoUrls: [],
        communityQuotesDesktopDisplayLimit: DEFAULT_COMMUNITY_QUOTES_DESKTOP_DISPLAY_LIMIT,
        communityQuotesMobileDisplayLimit: DEFAULT_COMMUNITY_QUOTES_MOBILE_DISPLAY_LIMIT,
      };
    }
  },
  ["faq-page-data"],
  {
    revalidate: 300,
    tags: [FAQ_PAGE_DATA_TAG],
  },
);

export async function getFaqPageData() {
  return getCachedFaqPageData();
}
