import { EventStatus, SetlistSection, TrackSeatStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { buildArchiveStats, buildUserArchiveStats } from "@/lib/domain/archive-stats";
import { getEffectiveEventStatus } from "@/lib/domain/event-status";
import {
  DEFAULT_LINEUP_DETAILS_MARKDOWN,
  DEFAULT_PARTICIPATION_RULES_MARKDOWN,
  SITE_CONTENT_ID,
  parseVideoUrls,
} from "@/lib/site-content";
import { getTrackCompletionSummary } from "@/lib/domain/track-completion";

export async function getHomePageData() {
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
            seats: true,
          },
        },
      },
      orderBy: { startsAt: "asc" },
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
                proposedBy: true,
                song: {
                  include: { artist: true },
                },
                seats: {
                  include: { user: true },
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
          track.seats.filter((seat) => seat.status === TrackSeatStatus.CLAIMED).map((seat) => seat.userId),
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
}

export async function getEventWorkspace(slug: string) {
  return db.event.findUnique({
    where: { slug },
    include: {
      lineupSlots: {
        include: { instrument: true },
        orderBy: { displayOrder: "asc" },
      },
      tracks: {
        where: { state: "ACTIVE" },
        include: {
          song: {
            include: { artist: true },
          },
          proposedBy: true,
          seats: {
            include: {
              user: true,
              lineupSlot: true,
              invites: {
                where: {
                  status: "PENDING",
                },
                include: {
                  recipient: true,
                  sender: true,
                },
              },
            },
            orderBy: [{ lineupSlot: { displayOrder: "asc" } }, { seatIndex: "asc" }],
          },
        },
        orderBy: { createdAt: "asc" },
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
                  user: true,
                  lineupSlot: true,
                },
              },
            },
          },
        },
        orderBy: [{ section: "asc" }, { orderIndex: "asc" }],
      },
      selectionRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      editLocks: {
        where: { expiresAt: { gt: new Date() } },
        include: { user: true },
      },
    },
  });
}

export async function getAdminDashboardData() {
  const [events, users, songRequests, groups, artists] = await Promise.all([
    db.event.findMany({
      orderBy: { startsAt: "asc" },
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
                  include: { user: true, lineupSlot: true },
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
            sender: true,
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
            recipient: true,
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
                proposedBy: true,
                song: {
                  include: { artist: true },
                },
                seats: {
                  include: { user: true },
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

export async function getFaqPageData() {
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
}
