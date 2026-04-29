import { describe, expect, it } from "vitest";

import { buildSongUpsertArgs } from "@/lib/song-identity";

describe("song identity helpers", () => {
  it("stores numeric iTunes external ids on songs", () => {
    const args = buildSongUpsertArgs({
      artistId: "artist-1",
      artistName: "Thornhill",
      trackTitle: "nerv",
      durationSeconds: 193,
      externalId: "1787004043",
    });

    expect(args.where).toEqual({ slug: "thornhill-nerv" });
    expect(args.create).toMatchObject({
      artistId: "artist-1",
      slug: "thornhill-nerv",
      title: "nerv",
      durationSeconds: 193,
      itunesTrackId: "1787004043",
    });
    expect(args.update).toMatchObject({
      title: "nerv",
      durationSeconds: 193,
      itunesTrackId: "1787004043",
    });
  });

  it("ignores non-numeric external ids", () => {
    const args = buildSongUpsertArgs({
      artistId: "artist-1",
      artistName: "Local Artist",
      trackTitle: "Local Song",
      durationSeconds: 0,
      externalId: "not-itunes",
    });

    expect(args.create).not.toHaveProperty("itunesTrackId");
    expect(args.update).not.toHaveProperty("itunesTrackId");
  });
});
