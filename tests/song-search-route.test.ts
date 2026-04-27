import { afterEach, describe, expect, it, vi } from "vitest";

const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const getClientIpFromHeadersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  getClientIpFromHeaders: getClientIpFromHeadersMock,
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
  it("falls back through artist lookup for artist-title queries that direct iTunes search misses", async () => {
    consumeRateLimitMock.mockReturnValue({ allowed: true });
    getClientIpFromHeadersMock.mockReturnValue("127.0.0.1");

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
});
