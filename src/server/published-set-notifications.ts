import { TrackSeatStatus } from "@prisma/client";

import { getTrackCompletionSummary } from "@/lib/domain/track-completion";

type PublishedSetSeatLite = {
  label: string;
  user: {
    id: string;
    telegramId: string | null;
  } | null;
  userId: string | null;
};

type PublishedSetItemLite = {
  orderIndex: number;
  track: {
    id: string;
    song: {
      title: string;
      artist: {
        name: string;
      };
    };
    seats: PublishedSetSeatLite[];
  };
};

type CompletedTableTrackLite = {
  id: string;
  seats: Array<
    PublishedSetSeatLite & {
      isOptional: boolean;
      status: TrackSeatStatus;
    }
  >;
};

export type PublishedSetNotification = {
  eventStartsAt: Date;
  eventTitle: string;
  recipientTelegramId: string | null;
  songs: Array<{
    orderIndex: number;
    positions: string[];
    songLabel: string;
  }>;
};

export type FinalSetMissedNotification = {
  eventTitle: string;
  recipientTelegramId: string | null;
};

type InternalPublishedSetSong = PublishedSetNotification["songs"][number] & {
  trackId: string;
};

type InternalPublishedSetNotification = {
  eventStartsAt: Date;
  eventTitle: string;
  recipientTelegramId: string | null;
  songs: InternalPublishedSetSong[];
};

export function buildPublishedSetNotifications({
  eventStartsAt,
  eventTitle,
  setlistItems,
}: {
  eventStartsAt: Date;
  eventTitle: string;
  setlistItems: PublishedSetItemLite[];
}) {
  const perUserNotifications = new Map<
    string,
    InternalPublishedSetNotification
  >();

  for (const item of setlistItems) {
    for (const seat of item.track.seats) {
      if (!seat.userId || !seat.user) {
        continue;
      }

      const existing: InternalPublishedSetNotification = perUserNotifications.get(seat.userId) ?? {
          eventStartsAt,
          eventTitle,
          recipientTelegramId: seat.user.telegramId,
          songs: [],
        };

      const songLabel = `${item.track.song.artist.name} - ${item.track.song.title}`;
      const songEntry = existing.songs.find((song) => song.trackId === item.track.id);

      if (songEntry) {
        if (!songEntry.positions.includes(seat.label)) {
          songEntry.positions.push(seat.label);
        }
      } else {
        existing.songs.push({
          orderIndex: item.orderIndex,
          positions: [seat.label],
          songLabel,
          trackId: item.track.id,
        });
      }

      perUserNotifications.set(seat.userId, existing);
    }
  }

  return [...perUserNotifications.values()].map((notification) => ({
    eventStartsAt: notification.eventStartsAt,
    eventTitle: notification.eventTitle,
    recipientTelegramId: notification.recipientTelegramId,
    songs: notification.songs.map((song) => ({
      orderIndex: song.orderIndex,
      positions: song.positions,
      songLabel: song.songLabel,
    })),
  }));
}

export function buildFinalSetMissedNotifications({
  eventTitle,
  finalSetlistItems,
  tracks,
}: {
  eventTitle: string;
  finalSetlistItems: PublishedSetItemLite[];
  tracks: CompletedTableTrackLite[];
}) {
  const finalSetUserIds = new Set<string>();
  for (const item of finalSetlistItems) {
    for (const seat of item.track.seats) {
      if (seat.userId) {
        finalSetUserIds.add(seat.userId);
      }
    }
  }

  const missedNotifications = new Map<string, FinalSetMissedNotification>();
  for (const track of tracks) {
    if (!getTrackCompletionSummary(track.seats).isComplete) {
      continue;
    }

    for (const seat of track.seats) {
      if (
        seat.status !== TrackSeatStatus.CLAIMED ||
        !seat.userId ||
        !seat.user ||
        finalSetUserIds.has(seat.userId)
      ) {
        continue;
      }

      missedNotifications.set(seat.userId, {
        eventTitle,
        recipientTelegramId: seat.user.telegramId,
      });
    }
  }

  return [...missedNotifications.values()];
}
