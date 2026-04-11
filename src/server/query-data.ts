import { cache } from "react";

import { EventStatus, SetlistSection, TrackSeatStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { FAQ_PAGE_DATA_TAG, HOME_PAGE_DATA_TAG } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { buildArchiveStats, buildUserArchiveStats } from "@/lib/domain/archive-stats";
import {
  getAutoSyncedEventStatus,
  getEffectiveEventStatus,
} from "@/lib/domain/event-status";
import {
  DEFAULT_LINEUP_DETAILS_MARKDOWN,
  DEFAULT_PARTICIPATION_RULES_MARKDOWN,
  SITE_CONTENT_ID,
  parseVideoUrls,
} from "@/lib/site-content";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";

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
  const now = new Date();
  const events = await db.event.findMany({
    where: {
      status: {
        in: [EventStatus.DRAFT, EventStatus.OPEN],
      },
      OR: [
        { registrationOpensAt: { not: null, lte: now } },
        { registrationClosesAt: { not: null, lte: now } },
      ],
    },
    select: {
      id: true,
      status: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
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

  await db.$transaction(
    updates.map((event) =>
      db.event.update({
        where: { id: event.id },
        data: { status: event.nextStatus },
      }),
    ),
  );
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

const getCachedHomePageData = unstable_cache(
  async () => {
    await syncDateDrivenEventStatuses();
    const now = new Date();
    const [events, archiveEvents] = await Promise.all([
      db.event.findMany({
        where: {
          OR: [{ status: { not: EventStatus.PUBLISHED } }, { startsAt: { gte: now } }],
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
      db.event.findMany({
        where: {
          status: EventStatus.PUBLISHED,
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
      publishedEvents: archiveEvents.slice(0, 5),
      archiveStats: buildArchiveStats(archiveEvents),
    };
  },
  ["home-page-data"],
  {
    revalidate: 60,
    tags: [HOME_PAGE_DATA_TAG],
  },
);

export async function getHomePageData() {
  return getCachedHomePageData();
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

  return db.event.findUnique({
    where: { slug },
    include: getEventWorkspaceInclude(),
  });
});

export async function getAdminDashboardData() {
  await syncDateDrivenEventStatuses();
  const [events, users, songRequests, groups, artists] = await Promise.all([
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
  ]);

  return {
    events,
    users,
    songRequests,
    groups,
    artists,
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
                OR: [{ status: { not: EventStatus.PUBLISHED } }, { startsAt: { gte: now } }],
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
                OR: [{ status: { not: EventStatus.PUBLISHED } }, { startsAt: { gte: now } }],
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
                OR: [{ status: { not: EventStatus.PUBLISHED } }, { startsAt: { gte: now } }],
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
        status: EventStatus.PUBLISHED,
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
        lineupVideoUrls: parseVideoUrls(content?.lineupVideoUrlsJson),
      };
    } catch {
      return {
        participationRulesMarkdown: DEFAULT_PARTICIPATION_RULES_MARKDOWN,
        lineupDetailsMarkdown: DEFAULT_LINEUP_DETAILS_MARKDOWN,
        lineupVideoUrls: [],
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
