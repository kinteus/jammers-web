import { SetlistSection } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildSetlistRecommendation } from "@/lib/domain/setlist-algorithm";

describe("buildSetlistRecommendation", () => {
  it("maximizes unique participant coverage before filling the remainder", () => {
    const result = buildSetlistRecommendation({
      maxSetTrackCount: 2,
      previousConcertSongIds: new Set(),
      candidates: [
        {
          id: "track-a",
          songId: "song-a",
          songTitle: "A",
          artistName: "Artist",
          participantIds: ["u1", "u2"],
          filledSeatRatio: 0.7,
          createdAt: new Date("2026-01-01T10:00:00Z"),
          matchedKnownGroupName: null,
        },
        {
          id: "track-b",
          songId: "song-b",
          songTitle: "B",
          artistName: "Artist",
          participantIds: ["u3", "u4"],
          filledSeatRatio: 0.6,
          createdAt: new Date("2026-01-01T10:01:00Z"),
          matchedKnownGroupName: null,
        },
        {
          id: "track-c",
          songId: "song-c",
          songTitle: "C",
          artistName: "Artist",
          participantIds: ["u1", "u2", "u3"],
          filledSeatRatio: 1,
          createdAt: new Date("2026-01-01T10:02:00Z"),
          matchedKnownGroupName: "Known Band",
        },
      ],
    });

    expect(result.selected).toHaveLength(2);
    expect(result.selected.map((item) => item.trackId)).toEqual(["track-a", "track-b"]);
    expect(result.selected.every((item) => item.section === SetlistSection.MAIN)).toBe(true);
    expect(result.coverageCount).toBe(4);
  });

  it("rejects songs that were played in the previous concert", () => {
    const result = buildSetlistRecommendation({
      maxSetTrackCount: 2,
      previousConcertSongIds: new Set(["song-repeat"]),
      candidates: [
        {
          id: "track-repeat",
          songId: "song-repeat",
          songTitle: "Repeat",
          artistName: "Artist",
          participantIds: ["u1"],
          filledSeatRatio: 0.5,
          createdAt: new Date("2026-01-01T10:00:00Z"),
          matchedKnownGroupName: null,
        },
      ],
    });

    expect(result.selected).toHaveLength(0);
    expect(result.backlog[0]?.trackId).toBe("track-repeat");
    expect(result.backlog[0]?.reasons[0]).toContain("previous concert");
  });
});
