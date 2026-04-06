import { NextResponse } from "next/server";

import { consumeRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

type ItunesSongResult = {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  collectionName?: string;
  trackViewUrl?: string;
  trackTimeMillis?: number;
};

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

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "8");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { results: [], error: "Song search provider is unavailable." },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as { results?: ItunesSongResult[] };
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

  for (const entry of payload.results ?? []) {
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
      externalUrl: entry.trackViewUrl ?? null,
      durationSeconds: entry.trackTimeMillis
        ? Math.round(entry.trackTimeMillis / 1000)
        : null,
    });
  }

  return NextResponse.json({ results: [...dedupedResults.values()] });
}
