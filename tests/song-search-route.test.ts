import { afterEach, describe, expect, it, vi } from "vitest";

const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const getClientIpFromHeadersMock = vi.hoisted(() => vi.fn());
const songFindManyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  getClientIpFromHeaders: getClientIpFromHeadersMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    song: {
      findMany: songFindManyMock,
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function mockItunesJson(payload: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }),
  );
}

describe("song search route", () => {
  it("falls back through artist lookup for artist-title queries without a dash", async () => {
    consumeRateLimitMock.mockReturnValue({ allowed: true });
    getClientIpFromHeadersMock.mockReturnValue("127.0.0.1");
    songFindManyMock.mockResolvedValue([]);

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockItunesJson({ results: [] }))
      .mockImplementationOnce(() =>
        mockItunesJson({
          results: [
            {
              wrapperType: "artist",
              artistId: 255330831,
              artistName: "Thornhill",
            },
          ],
        }),
      )
      .mockImplementationOnce(() =>
        mockItunesJson({
          results: [
            {
              wrapperType: "artist",
              artistId: 255330831,
              artistName: "Thornhill",
            },
            {
              wrapperType: "track",
              kind: "song",
              trackId: 1787004043,
              trackName: "nerv",
              artistName: "Thornhill",
              collectionName: "BODIES",
              trackViewUrl: "https://music.apple.com/us/album/nerv/1787004036?i=1787004043",
              trackTimeMillis: 192611,
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/song-search/route");
    const response = await GET(
      new Request("http://localhost/api/song-search?query=Thornhill%20nerv"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [
        {
          artistName: "Thornhill",
          externalId: "1787004043",
          trackTitle: "nerv",
        },
      ],
    });
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get("term")).toBe(
      "Thornhill",
    );
  });

  it("tries the longest plausible artist split before one-word artist fallback searches", async () => {
    consumeRateLimitMock.mockReturnValue({ allowed: true });
    getClientIpFromHeadersMock.mockReturnValue("127.0.0.1");
    songFindManyMock.mockResolvedValue([]);

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        mockItunesJson({
          results: [
            {
              wrapperType: "track",
              kind: "song",
              trackId: 1629105587,
              trackName: "Bad Things",
              artistName: "I Prevail",
              artworkUrl100: "http://is1-ssl.mzstatic.com/image/thumb/cover/100x100bb.jpg",
            },
          ],
        }),
      )
      .mockImplementationOnce(() =>
        mockItunesJson({
          results: [
            {
              wrapperType: "artist",
              artistId: 948448824,
              artistName: "I Prevail",
            },
          ],
        }),
      )
      .mockImplementationOnce(() =>
        mockItunesJson({
          results: [
            {
              wrapperType: "artist",
              artistId: 948448824,
              artistName: "I Prevail",
            },
            {
              wrapperType: "track",
              kind: "song",
              trackId: 1629105533,
              trackName: "Body Bag",
              artistName: "I Prevail",
              collectionName: "TRUE POWER",
              artworkUrl100: "http://is1-ssl.mzstatic.com/image/thumb/body-bag/100x100bb.jpg",
              trackViewUrl: "https://music.apple.com/us/album/body-bag/1629105248?i=1629105533",
              trackTimeMillis: 196000,
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/song-search/route");
    const response = await GET(
      new Request("http://localhost/api/song-search?query=i%20prevail%20body%20bag"),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.results[0]).toMatchObject({
      artistName: "I Prevail",
      artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/body-bag/200x200bb.jpg",
      externalId: "1629105533",
      trackTitle: "Body Bag",
    });
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get("term")).toBe(
      "i prevail",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falls back through artist lookup for artist-title queries that direct iTunes search misses", async () => {
    consumeRateLimitMock.mockReturnValue({ allowed: true });
    getClientIpFromHeadersMock.mockReturnValue("127.0.0.1");
    songFindManyMock.mockResolvedValue([]);

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockItunesJson({ results: [] }))
      .mockImplementationOnce(() =>
        mockItunesJson({
          results: [
            {
              wrapperType: "artist",
              artistId: 255330831,
              artistName: "Thornhill",
            },
          ],
        }),
      )
      .mockImplementationOnce(() =>
        mockItunesJson({
          results: [
            {
              wrapperType: "artist",
              artistId: 255330831,
              artistName: "Thornhill",
            },
            {
              wrapperType: "track",
              kind: "song",
              trackId: 1787004043,
              trackName: "nerv",
              artistName: "Thornhill",
              collectionName: "BODIES",
              trackViewUrl: "https://music.apple.com/us/album/nerv/1787004036?i=1787004043",
              trackTimeMillis: 192611,
            },
            {
              wrapperType: "track",
              kind: "song",
              trackId: 1787004039,
              trackName: "Silver Swarm",
              artistName: "Thornhill",
              collectionName: "BODIES",
              trackTimeMillis: 273525,
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/song-search/route");
    const response = await GET(
      new Request("http://localhost/api/song-search?query=Thornhill%20-%20nerv"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [
        {
          artistName: "Thornhill",
          externalId: "1787004043",
          trackTitle: "nerv",
          collectionName: "BODIES",
          durationSeconds: 193,
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get("entity")).toBe(
      "musicArtist",
    );
    expect(new URL(String(fetchMock.mock.calls[2][0])).pathname).toBe("/lookup");
  });

  it("returns local catalog matches when iTunes is unavailable", async () => {
    consumeRateLimitMock.mockReturnValue({ allowed: true });
    getClientIpFromHeadersMock.mockReturnValue("127.0.0.1");
    songFindManyMock.mockResolvedValue([
      {
        id: "song-local-1",
        title: "Сонный свет",
        durationSeconds: 241,
        itunesTrackId: null,
        artist: {
          name: "Минус Трели",
        },
      },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { GET } = await import("@/app/api/song-search/route");
    const response = await GET(
      new Request("http://localhost/api/song-search?query=%D1%81%D0%BE%D0%BD"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [
        {
          artistName: "Минус Трели",
          durationSeconds: 241,
          externalId: "",
          songId: "song-local-1",
          trackTitle: "Сонный свет",
        },
      ],
      warning: "Song search provider is unavailable. Showing local catalog matches.",
    });
  });
});
