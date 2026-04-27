import { NextResponse } from "next/server";

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
  dedupedResults: Map<
    string,
    {
      externalId: string;
      trackTitle: string;
      artistName: string;
      artworkUrl: string | null;
      collectionName: string | null;
      externalUrl: string | null;
      durationSeconds: number | null;
    }
  >,
  entries: ItunesSongResult[],
) {
  for (const entry of entries) {
    const dedupeKey = `${entry.artistName.toLowerCase()}::${entry.trackName.toLowerCase()}`;
    if (dedupedResults.has(dedupeKey)) {
      continue;
    }

    dedupedResults.set(dedupeKey, {
      externalId: String(entry.trackId),
      trackTitle: entry.trackName,
      artistName: entry.artistName,
      artworkUrl: entry.artworkUrl100 ?? null,
      collectionName: entry.collectionName ?? null,
      externalUrl: normalizeAppleMusicUrl(entry.trackViewUrl),
      durationSeconds: entry.trackTimeMillis
        ? Math.round(entry.trackTimeMillis / 1000)
        : null,
    });
  }
}

async function fetchArtistLookupFallback(query: string) {
  const parsedQuery = parseArtistTitleQuery(query);
  if (!parsedQuery) {
    return [];
  }

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

  let searchResults: ItunesSongResult[];
  try {
    searchResults = (await fetchItunesResults<ItunesSongResult>(url)).filter(isSongResult);
  } catch {
    return NextResponse.json(
      { results: [], error: "Song search provider is unavailable." },
      { status: 502 },
    );
  }

  const dedupedResults = new Map<
    string,
    {
      externalId: string;
      trackTitle: string;
      artistName: string;
      artworkUrl: string | null;
      collectionName: string | null;
      externalUrl: string | null;
      durationSeconds: number | null;
    }
  >();
  const parsedQuery = parseArtistTitleQuery(query);
  const shouldUseArtistLookup =
    parsedQuery && !searchResults.some((entry) => trackMatchesParsedQuery(entry, parsedQuery));

  if (shouldUseArtistLookup) {
    try {
      addDedupedResults(dedupedResults, await fetchArtistLookupFallback(query));
    } catch {
      // Keep direct search results when the fallback provider path is unavailable.
    }
  }
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
