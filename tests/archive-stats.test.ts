import { TrackSeatStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildArchiveStats, buildUserArchiveStats } from "@/lib/domain/archive-stats";

const claimed = TrackSeatStatus.CLAIMED;

describe("archive stats", () => {
  const events = [
    {
      id: "gig-1",
      title: "First Night",
      startsAt: new Date("2025-01-10T20:00:00.000Z"),
      setlistItems: [
        {
          orderIndex: 1,
          track: {
            id: "track-1",
            proposedById: "u1",
            proposedBy: { id: "u1", telegramUsername: "anna", fullName: "Anna" },
            song: { title: "Song A", artist: { name: "Artist A" } },
            seats: [
              {
                label: "Drums",
                status: claimed,
                userId: "u1",
                user: { id: "u1", telegramUsername: "anna", fullName: "Anna" },
              },
              {
                label: "Bass",
                status: claimed,
                userId: "u2",
                user: { id: "u2", telegramUsername: "boris", fullName: "Boris" },
              },
            ],
          },
        },
      ],
    },
    {
      id: "gig-2",
      title: "Second Night",
      startsAt: new Date("2026-02-02T20:00:00.000Z"),
      setlistItems: [
        {
          orderIndex: 1,
          track: {
            id: "track-2",
            proposedById: "u2",
            proposedBy: { id: "u2", telegramUsername: "boris", fullName: "Boris" },
            song: { title: "Song A", artist: { name: "Artist A" } },
            seats: [
              {
                label: "Drums",
                status: claimed,
                userId: "u1",
                user: { id: "u1", telegramUsername: "anna", fullName: "Anna" },
              },
              {
                label: "Vocals",
                status: claimed,
                userId: "u3",
                user: { id: "u3", telegramUsername: null, fullName: "Chris" },
              },
            ],
          },
        },
      ],
    },
  ];

  it("builds global archive rankings and timeline", () => {
    const summary = buildArchiveStats(events);

    expect(summary.totalGigs).toBe(2);
    expect(summary.totalTracks).toBe(2);
    expect(summary.uniqueSongs).toBe(1);
    expect(summary.totalMusicians).toBe(3);
    expect(summary.busiestGig?.title).toBe("First Night");
    expect(summary.topArtists[0]).toMatchObject({ label: "Artist A", value: 2 });
    expect(summary.topMusicians[0]).toMatchObject({ label: "@anna", value: 2, hint: "2" });
    expect(summary.timeline).toEqual([
      { year: "2026", gigs: 1, tracks: 1 },
      { year: "2025", gigs: 1, tracks: 1 },
    ]);
  });

  it("builds user-focused archive stats", () => {
    const summary = buildUserArchiveStats(events, "u1");

    expect(summary.gigsPlayed).toBe(2);
    expect(summary.songsPerformed).toBe(2);
    expect(summary.songsOriginated).toBe(1);
    expect(summary.roleFamiliesCovered).toBe(1);
    expect(summary.signatureRole).toBe("rhythm");
    expect(summary.favoriteArtist).toBe("Artist A");
    expect(summary.topCollaborators[0]).toMatchObject({ label: "@boris", value: 1 });
    expect(summary.latestGig?.title).toBe("Second Night");
    expect(summary.firstGig?.title).toBe("First Night");
  });
});
