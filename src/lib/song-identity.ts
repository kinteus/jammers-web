import { slugify } from "@/lib/utils";

type BuildSongUpsertArgsInput = {
  artistId: string;
  artistName: string;
  trackTitle: string;
  durationSeconds: number;
  externalId?: string | null;
};

function normalizeItunesTrackId(externalId: string | null | undefined) {
  const trimmed = externalId?.trim();
  return trimmed && /^\d+$/.test(trimmed) ? trimmed : null;
}

export function buildSongUpsertArgs({
  artistId,
  artistName,
  trackTitle,
  durationSeconds,
  externalId,
}: BuildSongUpsertArgsInput) {
  const slug = slugify(`${artistName}-${trackTitle}`);
  const itunesTrackId = normalizeItunesTrackId(externalId);
  const durationData = durationSeconds > 0 ? { durationSeconds } : {};
  const itunesData = itunesTrackId ? { itunesTrackId } : {};

  return {
    where: { slug },
    update: {
      title: trackTitle,
      ...durationData,
      ...itunesData,
    },
    create: {
      artistId,
      slug,
      title: trackTitle,
      durationSeconds: durationSeconds > 0 ? durationSeconds : null,
      ...itunesData,
    },
  };
}
