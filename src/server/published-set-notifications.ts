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
