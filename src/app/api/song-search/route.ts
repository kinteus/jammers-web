import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { consumeRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { normalizeAppleMusicUrl } from "@/lib/url-security";

type ItunesSongResult = {
  wrapperType?: string;
  kind?: string;
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  collectionName?: string;
  trackViewUrl?: string;
  trackTimeMillis?: number;
};

type ItunesArtistResult = {
  wrapperType?: string;
  artistId: number;
  artistName: string;
};

const SONG_SEARCH_CACHE_SECONDS = 60 * 60;
const SONG_SEARCH_LIMIT = 8;
const ARTIST_LOOKUP_LIMIT = 200;
const ITUNES_TIMEOUT_MS = 6000;

type SongSearchResult = {
  songId?: string | null;
  externalId: string;
  trackTitle: string;
  artistName: string;
  artworkUrl: string | null;
  collectionName: string | null;
  externalUrl: string | null;
  durationSeconds: number | null;
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseArtistTitleQuery(query: string) {
  const match = query.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!match) {
    return null;
  }

  const artistName = match[1]?.trim();
  const trackTitle = match[2]?.trim();

  if (!artistName || !trackTitle) {
    return null;
  }

  return { artistName, trackTitle };
}

function getArtistTitleQueryCandidates(query: string) {
  const explicitQuery = parseArtistTitleQuery(query);
  if (explicitQuery) {
    return [explicitQuery];
  }

  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return [];
  }

  const candidates: Array<{ artistName: string; trackTitle: string }> = [];
  const maxArtistWords = Math.min(words.length - 1, 5);
  for (let wordCount = 1; wordCount <= maxArtistWords; wordCount += 1) {
    candidates.push({
      artistName: words.slice(0, wordCount).join(" "),
      trackTitle: words.slice(wordCount).join(" "),
    });
  }

  return candidates.sort((left, right) => {
    const leftArtistWords = left.artistName.split(/\s+/).length;
    const rightArtistWords = right.artistName.split(/\s+/).length;
    const leftTitleWords = left.trackTitle.split(/\s+/).length;
    const rightTitleWords = right.trackTitle.split(/\s+/).length;
    const leftHasUsefulTitle = leftTitleWords >= 2;
    const rightHasUsefulTitle = rightTitleWords >= 2;

    if (leftHasUsefulTitle !== rightHasUsefulTitle) {
      return leftHasUsefulTitle ? -1 : 1;
    }

    return rightArtistWords - leftArtistWords;
  });
}

function createSearchUrl(pathname: "/search" | "/lookup", params: Record<string, string>) {
  const url = new URL(`https://itunes.apple.com${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function fetchItunesResults<T>(url: URL) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
    next: {
      revalidate: SONG_SEARCH_CACHE_SECONDS,
    },
    signal:
      typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(ITUNES_TIMEOUT_MS)
        : undefined,
  });

  if (!response.ok) {
    throw new Error("itunes-unavailable");
  }

  const payload = (await response.json()) as { results?: T[] };
  return payload.results ?? [];
}

function isSongResult(entry: Partial<ItunesSongResult>): entry is ItunesSongResult {
  return (
    entry.wrapperType === "track" &&
    entry.kind === "song" &&
    typeof entry.trackId === "number" &&
    typeof entry.trackName === "string" &&
    typeof entry.artistName === "string"
  );
}

function isArtistResult(entry: Partial<ItunesArtistResult>): entry is ItunesArtistResult {
  return (
    entry.wrapperType === "artist" &&
    typeof entry.artistId === "number" &&
    typeof entry.artistName === "string"
  );
}

function trackMatchesParsedQuery(
  entry: ItunesSongResult,
  parsedQuery: NonNullable<ReturnType<typeof parseArtistTitleQuery>>,
) {
  const artist = normalizeSearchText(entry.artistName);
  const expectedArtist = normalizeSearchText(parsedQuery.artistName);
  const title = normalizeSearchText(entry.trackName);
  const expectedTitle = normalizeSearchText(parsedQuery.trackTitle);

  return (
    (artist === expectedArtist ||
      artist.includes(expectedArtist) ||
      expectedArtist.includes(artist)) &&
    (title === expectedTitle ||
      title.includes(expectedTitle) ||
      expectedTitle.includes(title))
  );
}

function rankLookupSongs(
  songs: ItunesSongResult[],
  parsedQuery: NonNullable<ReturnType<typeof parseArtistTitleQuery>>,
) {
  const expectedTitle = normalizeSearchText(parsedQuery.trackTitle);
  const expectedArtist = normalizeSearchText(parsedQuery.artistName);

  return songs
    .map((song) => {
      const title = normalizeSearchText(song.trackName);
      const artist = normalizeSearchText(song.artistName);
      let score = 0;

      if (title === expectedTitle) {
        score += 100;
      } else if (title.includes(expectedTitle) || expectedTitle.includes(title)) {
        score += 55;
      }

      if (artist === expectedArtist) {
        score += 40;
      } else if (artist.includes(expectedArtist) || expectedArtist.includes(artist)) {
        score += 20;
      }

      return { score, song };
    })
    .filter((entry) => entry.score >= 75)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.song);
}

function addDedupedResults(
  dedupedResults: Map<string, SongSearchResult>,
  entries: ItunesSongResult[],
) {
  for (const entry of entries) {
    const dedupeKey = `${entry.artistName.toLowerCase()}::${entry.trackName.toLowerCase()}`;
    if (dedupedResults.has(dedupeKey)) {
      continue;
    }

    dedupedResults.set(dedupeKey, {
      songId: null,
      externalId: String(entry.trackId),
      trackTitle: entry.trackName,
      artistName: entry.artistName,
      artworkUrl: normalizeItunesArtworkUrl(entry.artworkUrl100),
      collectionName: entry.collectionName ?? null,
      externalUrl: normalizeAppleMusicUrl(entry.trackViewUrl),
      durationSeconds: entry.trackTimeMillis
        ? Math.round(entry.trackTimeMillis / 1000)
        : null,
    });
  }
}

function normalizeItunesArtworkUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    url.protocol = "https:";
    return url.toString().replace(/100x100bb(?=\.[a-z0-9]+$)/i, "200x200bb");
  } catch {
    return null;
  }
}

function addDedupedLocalResults(
  dedupedResults: Map<string, SongSearchResult>,
  entries: SongSearchResult[],
) {
  for (const entry of entries) {
    const dedupeKey = `${entry.artistName.toLowerCase()}::${entry.trackTitle.toLowerCase()}`;
    if (dedupedResults.has(dedupeKey)) {
      continue;
    }

    dedupedResults.set(dedupeKey, entry);
  }
}

async function fetchLocalCatalogResults(query: string) {
  const artistTitleQueries = getArtistTitleQueryCandidates(query);
  const localSongs = await db.song.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { artist: { name: { contains: query, mode: "insensitive" } } },
        ...artistTitleQueries.map((parsedQuery) => ({
          AND: [
            { title: { contains: parsedQuery.trackTitle, mode: "insensitive" as const } },
            {
              artist: {
                name: { contains: parsedQuery.artistName, mode: "insensitive" as const },
              },
            },
          ],
        })),
      ],
    },
    include: {
      artist: {
        select: { name: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    take: SONG_SEARCH_LIMIT,
  });

  return localSongs.map((song) => ({
    songId: song.id,
    externalId: song.itunesTrackId ?? "",
    trackTitle: song.title,
    artistName: song.artist.name,
    artworkUrl: null,
    collectionName: null,
    externalUrl: null,
    durationSeconds: song.durationSeconds,
  }));
}

async function fetchArtistLookupFallback(
  parsedQuery: NonNullable<ReturnType<typeof parseArtistTitleQuery>>,
) {
  const artistResults = await fetchItunesResults<ItunesArtistResult>(
    createSearchUrl("/search", {
      term: parsedQuery.artistName,
      media: "music",
      entity: "musicArtist",
      attribute: "artistTerm",
      country: "US",
      limit: "5",
    }),
  );
  const artistIds = artistResults
    .filter(isArtistResult)
    .filter((artist) => {
      const foundArtist = normalizeSearchText(artist.artistName);
      const expectedArtist = normalizeSearchText(parsedQuery.artistName);
      return foundArtist === expectedArtist || foundArtist.includes(expectedArtist);
    })
    .slice(0, 3)
    .map((artist) => String(artist.artistId));

  if (artistIds.length === 0) {
    return [];
  }

  const lookupResults = await fetchItunesResults<ItunesSongResult | ItunesArtistResult>(
    createSearchUrl("/lookup", {
      id: artistIds.join(","),
      entity: "song",
      country: "US",
      limit: String(ARTIST_LOOKUP_LIMIT),
    }),
  );

  return rankLookupSongs(lookupResults.filter(isSongResult), parsedQuery);
}

async function fetchArtistLookupFallbacks(query: string) {
  for (const candidate of getArtistTitleQueryCandidates(query)) {
    const results = await fetchArtistLookupFallback(candidate);
    if (results.length > 0) {
      return results;
    }
  }

  return [];
}

export async function GET(request: Request) {
  const rateLimit = consumeRateLimit({
    key: `song-search:${getClientIpFromHeaders(request.headers)}`,
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { results: [], error: "Too many search requests. Please slow down a bit." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = createSearchUrl("/search", {
    term: query,
    media: "music",
    entity: "song",
    country: "US",
    limit: String(SONG_SEARCH_LIMIT),
  });

  let localResults: SongSearchResult[] = [];
  try {
    localResults = await fetchLocalCatalogResults(query);
  } catch {
    localResults = [];
  }

  let searchResults: ItunesSongResult[];
  try {
    searchResults = (await fetchItunesResults<ItunesSongResult>(url)).filter(isSongResult);
  } catch {
    return NextResponse.json({
      results: localResults,
      warning: localResults.length > 0
        ? "Song search provider is unavailable. Showing local catalog matches."
        : "Song search provider is unavailable.",
    });
  }

  const dedupedResults = new Map<string, SongSearchResult>();
  const parsedQueries = getArtistTitleQueryCandidates(query);
  const shouldUseArtistLookup =
    parsedQueries.length > 0 &&
    !parsedQueries.some((parsedQuery) =>
      searchResults.some((entry) => trackMatchesParsedQuery(entry, parsedQuery)),
    );

  if (shouldUseArtistLookup) {
    try {
      addDedupedResults(dedupedResults, await fetchArtistLookupFallbacks(query));
    } catch {
      // Keep direct search results when the fallback provider path is unavailable.
    }
  }
  addDedupedLocalResults(dedupedResults, localResults);
  addDedupedResults(dedupedResults, searchResults);

  return NextResponse.json(
    { results: [...dedupedResults.values()].slice(0, SONG_SEARCH_LIMIT) },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${SONG_SEARCH_CACHE_SECONDS}, stale-while-revalidate=${SONG_SEARCH_CACHE_SECONDS}`,
      },
    },
  );
}
