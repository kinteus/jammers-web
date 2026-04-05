import { TrackSeatStatus } from "@prisma/client";

import { getRoleFamilyKey } from "@/lib/role-families";
import type { RoleFamilyKey } from "@/lib/role-families";

type ArchiveUserLite = {
  id: string;
  telegramUsername: string | null;
  fullName: string | null;
} | null;

type ArchiveSeatLite = {
  label: string;
  status: TrackSeatStatus;
  userId: string | null;
  user: ArchiveUserLite;
};

type ArchiveTrackLite = {
  id: string;
  proposedById: string;
  proposedBy: ArchiveUserLite;
  song: {
    title: string;
    artist: {
      name: string;
    };
  };
  seats: ArchiveSeatLite[];
};

export type ArchiveStatsEvent = {
  id: string;
  title: string;
  startsAt: Date;
  setlistItems: Array<{
    orderIndex: number;
    track: ArchiveTrackLite;
  }>;
};

export type ArchiveRankingItem = {
  id: string;
  label: string;
  value: number;
  hint?: string;
};

export type ArchiveStatsSummary = {
  totalGigs: number;
  totalTracks: number;
  uniqueSongs: number;
  totalMusicians: number;
  topMusicians: ArchiveRankingItem[];
  topOriginators: ArchiveRankingItem[];
  topArtists: ArchiveRankingItem[];
  topSongs: ArchiveRankingItem[];
  timeline: Array<{
    year: string;
    gigs: number;
    tracks: number;
  }>;
  busiestGig: {
    title: string;
    tracks: number;
  } | null;
};

export type UserArchiveStatsSummary = {
  gigsPlayed: number;
  songsPerformed: number;
  songsOriginated: number;
  roleFamiliesCovered: number;
  signatureRole: RoleFamilyKey | null;
  favoriteArtist: string | null;
  topCollaborators: ArchiveRankingItem[];
  timeline: Array<{
    year: string;
    tracks: number;
  }>;
  latestGig: {
    title: string;
    startsAt: Date;
  } | null;
  firstGig: {
    title: string;
    startsAt: Date;
  } | null;
};

function formatUserLabel(user: ArchiveUserLite) {
  if (!user) {
    return "Unknown";
  }
  if (user.telegramUsername) {
    return `@${user.telegramUsername}`;
  }
  return user.fullName ?? "Unknown";
}

function sortRanking(map: Map<string, { label: string; value: number; hint?: string }>, take = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1].value - a[1].value || a[1].label.localeCompare(b[1].label))
    .slice(0, take)
    .map(([id, item]) => ({
      id,
      label: item.label,
      value: item.value,
      hint: item.hint,
    }));
}

export function buildArchiveStats(events: ArchiveStatsEvent[]): ArchiveStatsSummary {
  const mainTracks = events.flatMap((event) =>
    event.setlistItems.map((item) => ({
      event,
      track: item.track,
    })),
  );

  const musicianTracks = new Map<
    string,
    { label: string; value: number; gigs: Set<string>; tracks: Set<string> }
  >();
  const originators = new Map<string, { label: string; value: number }>();
  const artists = new Map<string, { label: string; value: number }>();
  const songs = new Map<string, { label: string; value: number }>();
  const yearMap = new Map<string, { gigs: Set<string>; tracks: number }>();
  const uniqueSongs = new Set<string>();
  const uniqueMusicians = new Set<string>();

  for (const { event, track } of mainTracks) {
    const songKey = `${track.song.artist.name}::${track.song.title}`;
    uniqueSongs.add(songKey);

    artists.set(track.song.artist.name, {
      label: track.song.artist.name,
      value: (artists.get(track.song.artist.name)?.value ?? 0) + 1,
    });

    songs.set(songKey, {
      label: `${track.song.artist.name} - ${track.song.title}`,
      value: (songs.get(songKey)?.value ?? 0) + 1,
    });

    if (track.proposedBy && track.proposedBy.telegramUsername !== "legacy_import") {
      const originatorKey = track.proposedBy.id;
      originators.set(originatorKey, {
        label: formatUserLabel(track.proposedBy),
        value: (originators.get(originatorKey)?.value ?? 0) + 1,
      });
    }

    const year = String(event.startsAt.getFullYear());
    const yearEntry = yearMap.get(year) ?? { gigs: new Set<string>(), tracks: 0 };
    yearEntry.gigs.add(event.id);
    yearEntry.tracks += 1;
    yearMap.set(year, yearEntry);

    const performersOnTrack = new Map<string, ArchiveUserLite>();
    for (const seat of track.seats) {
      if (seat.status !== TrackSeatStatus.CLAIMED || !seat.userId || !seat.user) {
        continue;
      }
      performersOnTrack.set(seat.userId, seat.user);
    }

    for (const [userId, user] of performersOnTrack.entries()) {
      uniqueMusicians.add(userId);
      const current = musicianTracks.get(userId) ?? {
        label: formatUserLabel(user),
        value: 0,
        gigs: new Set<string>(),
        tracks: new Set<string>(),
      };

      if (!current.tracks.has(track.id)) {
        current.tracks.add(track.id);
        current.value += 1;
      }

      current.gigs.add(event.id);
      musicianTracks.set(userId, current);
    }
  }

  const busiestGig =
    events
      .map((event) => ({
        title: event.title,
        tracks: event.setlistItems.length,
      }))
      .sort((a, b) => b.tracks - a.tracks)[0] ?? null;

  const topMusicians = [...musicianTracks.entries()]
    .sort((a, b) => b[1].value - a[1].value || a[1].label.localeCompare(b[1].label))
    .slice(0, 5)
    .map(([id, entry]) => ({
      id,
      label: entry.label,
      value: entry.value,
      hint: String(entry.gigs.size),
    }));

  return {
    totalGigs: events.length,
    totalTracks: mainTracks.length,
    uniqueSongs: uniqueSongs.size,
    totalMusicians: uniqueMusicians.size,
    topMusicians,
    topOriginators: sortRanking(originators),
    topArtists: sortRanking(artists),
    topSongs: sortRanking(songs),
    timeline: [...yearMap.entries()]
      .map(([year, entry]) => ({
        year,
        gigs: entry.gigs.size,
        tracks: entry.tracks,
      }))
      .sort((a, b) => Number(b.year) - Number(a.year)),
    busiestGig,
  };
}

export function buildUserArchiveStats(
  events: ArchiveStatsEvent[],
  userId: string,
): UserArchiveStatsSummary {
  const playedTracks = events.flatMap((event) =>
    event.setlistItems
      .filter((item) =>
        item.track.seats.some(
          (seat) => seat.status === TrackSeatStatus.CLAIMED && seat.userId === userId,
        ),
      )
      .map((item) => ({
        event,
        track: item.track,
      })),
  );

  const originatedTracks = events.flatMap((event) =>
    event.setlistItems
      .filter((item) => item.track.proposedById === userId)
      .map((item) => ({
        event,
        track: item.track,
      })),
  );

  const roleCounts = new Map<RoleFamilyKey, number>();
  const artistCounts = new Map<string, number>();
  const collaboratorCounts = new Map<string, { label: string; value: number }>();
  const gigIds = new Set<string>();
  const yearCounts = new Map<string, number>();

  for (const { event, track } of playedTracks) {
    gigIds.add(event.id);
    const year = String(event.startsAt.getFullYear());
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
    artistCounts.set(track.song.artist.name, (artistCounts.get(track.song.artist.name) ?? 0) + 1);

    const collaboratorsOnTrack = new Set<string>();
    for (const seat of track.seats) {
      if (seat.status !== TrackSeatStatus.CLAIMED || !seat.userId || !seat.user) {
        continue;
      }
      if (seat.userId === userId) {
        const family = getRoleFamilyKey(seat.label);
        roleCounts.set(family, (roleCounts.get(family) ?? 0) + 1);
        continue;
      }
      if (collaboratorsOnTrack.has(seat.userId)) {
        continue;
      }
      collaboratorsOnTrack.add(seat.userId);
      collaboratorCounts.set(seat.userId, {
        label: formatUserLabel(seat.user),
        value: (collaboratorCounts.get(seat.userId)?.value ?? 0) + 1,
      });
    }
  }

  const signatureRole =
    [...roleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const favoriteArtist =
    [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const latestGig =
    playedTracks
      .slice()
      .sort((a, b) => b.event.startsAt.getTime() - a.event.startsAt.getTime())[0]?.event ?? null;
  const firstGig =
    playedTracks
      .slice()
      .sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime())[0]?.event ?? null;

  return {
    gigsPlayed: gigIds.size,
    songsPerformed: playedTracks.length,
    songsOriginated: originatedTracks.length,
    roleFamiliesCovered: roleCounts.size,
    signatureRole,
    favoriteArtist,
    topCollaborators: sortRanking(collaboratorCounts, 4),
    timeline: [...yearCounts.entries()]
      .map(([year, tracks]) => ({ year, tracks }))
      .sort((a, b) => Number(b.year) - Number(a.year)),
    latestGig: latestGig
      ? {
          title: latestGig.title,
          startsAt: latestGig.startsAt,
        }
      : null,
    firstGig: firstGig
      ? {
          title: firstGig.title,
          startsAt: firstGig.startsAt,
        }
      : null,
  };
}
