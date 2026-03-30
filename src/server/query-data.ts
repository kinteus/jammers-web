import { EventStatus, SetlistSection, TrackSeatStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getEffectiveEventStatus } from "@/lib/domain/event-status";

export async function getHomePageData() {
  const [events, publishedEvents] = await Promise.all([
    db.event.findMany({
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
      },
      include: {
        setlistItems: {
          where: { section: SetlistSection.MAIN },
        },
      },
      orderBy: { startsAt: "desc" },
      take: 5,
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
    })),
    publishedEvents,
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
  return db.user.findUnique({
    where: { id: userId },
    include: {
      instruments: {
        include: { instrument: true },
      },
      trackSeats: {
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
    },
  });
}
