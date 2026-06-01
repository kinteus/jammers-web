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
          hasUnfilledRequiredSeats: false,
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
          hasUnfilledRequiredSeats: false,
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
          hasUnfilledRequiredSeats: false,
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

  it("chooses the globally best combination when the greedy first pick is worse", () => {
    const result = buildSetlistRecommendation({
      maxSetTrackCount: 2,
      previousConcertSongIds: new Set(),
      candidates: [
        {
          id: "large-overlap",
          songId: "song-large",
          songTitle: "Large",
          artistName: "Artist",
          hasUnfilledRequiredSeats: false,
          participantIds: ["u1", "u2", "u3", "u4"],
          filledSeatRatio: 1,
          createdAt: new Date("2026-01-01T10:00:00Z"),
          matchedKnownGroupName: null,
        },
        {
          id: "left-cover",
          songId: "song-left",
          songTitle: "Left",
          artistName: "Artist",
          hasUnfilledRequiredSeats: false,
          participantIds: ["u1", "u2", "u5"],
          filledSeatRatio: 1,
          createdAt: new Date("2026-01-01T10:01:00Z"),
          matchedKnownGroupName: null,
        },
        {
          id: "right-cover",
          songId: "song-right",
          songTitle: "Right",
          artistName: "Artist",
          hasUnfilledRequiredSeats: false,
          participantIds: ["u3", "u4", "u6"],
          filledSeatRatio: 1,
          createdAt: new Date("2026-01-01T10:02:00Z"),
          matchedKnownGroupName: null,
        },
      ],
    });

    expect(result.selected.map((item) => item.trackId)).toEqual(["left-cover", "right-cover"]);
    expect(result.coverageCount).toBe(6);
  });

  it("counts each participant once even when they occupy multiple seats on a track", () => {
    const result = buildSetlistRecommendation({
      maxSetTrackCount: 2,
      minParticipantsPerTrack: 2,
      previousConcertSongIds: new Set(),
      candidates: [
        {
          id: "one-person-multiseat",
          songId: "song-one-person",
          songTitle: "One Person",
          artistName: "Artist",
          hasUnfilledRequiredSeats: false,
          participantIds: ["u1", "u1"],
          filledSeatRatio: 1,
          createdAt: new Date("2026-01-01T10:00:00Z"),
          matchedKnownGroupName: null,
        },
        {
          id: "actual-duo",
          songId: "song-duo",
          songTitle: "Actual Duo",
          artistName: "Artist",
          hasUnfilledRequiredSeats: false,
          participantIds: ["u2", "u3"],
          filledSeatRatio: 1,
          createdAt: new Date("2026-01-01T10:01:00Z"),
          matchedKnownGroupName: null,
        },
      ],
    });

    expect(result.selected.map((item) => item.trackId)).toEqual(["actual-duo"]);
    expect(result.backlog.find((item) => item.trackId === "one-person-multiseat")).toBeUndefined();
    expect(result.coverageCount).toBe(2);
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
          hasUnfilledRequiredSeats: false,
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

  it("keeps tracks with unfilled required seats out of the final set", () => {
    const result = buildSetlistRecommendation({
      maxSetTrackCount: 2,
      previousConcertSongIds: new Set(),
      candidates: [
        {
          id: "incomplete-popular",
          songId: "song-incomplete",
          songTitle: "Incomplete",
          artistName: "Artist",
          hasUnfilledRequiredSeats: true,
          participantIds: ["u1", "u2", "u3", "u4"],
          filledSeatRatio: 0.8,
          createdAt: new Date("2026-01-01T10:00:00Z"),
          matchedKnownGroupName: null,
        },
        {
          id: "complete-smaller",
          songId: "song-complete",
          songTitle: "Complete",
          artistName: "Artist",
          hasUnfilledRequiredSeats: false,
          participantIds: ["u5", "u6"],
          filledSeatRatio: 1,
          createdAt: new Date("2026-01-01T10:01:00Z"),
          matchedKnownGroupName: null,
        },
      ],
    });

    expect(result.selected.map((item) => item.trackId)).toEqual(["complete-smaller"]);
    expect(result.backlog.find((item) => item.trackId === "incomplete-popular")).toBeUndefined();
    expect(result.coverageCount).toBe(2);
  });

  it("keeps tracks below the event minimum participant count out of the final set and backlog", () => {
    const result = buildSetlistRecommendation({
      maxSetTrackCount: 2,
      minParticipantsPerTrack: 2,
      previousConcertSongIds: new Set(),
      candidates: [
        {
          id: "solo-track",
          songId: "song-solo",
          songTitle: "Solo",
          artistName: "Artist",
          hasUnfilledRequiredSeats: false,
          participantIds: ["u1"],
          filledSeatRatio: 1,
          createdAt: new Date("2026-01-01T10:00:00Z"),
          matchedKnownGroupName: null,
        },
        {
          id: "duo-track",
          songId: "song-duo",
          songTitle: "Duo",
          artistName: "Artist",
          hasUnfilledRequiredSeats: false,
          participantIds: ["u2", "u3"],
          filledSeatRatio: 1,
          createdAt: new Date("2026-01-01T10:01:00Z"),
          matchedKnownGroupName: null,
        },
      ],
    });

    expect(result.selected.map((item) => item.trackId)).toEqual(["duo-track"]);
    expect(result.backlog.find((item) => item.trackId === "solo-track")).toBeUndefined();
    expect(result.coverageCount).toBe(2);
  });
});
