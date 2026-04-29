import { describe, expect, it } from "vitest";

import {
  detectJamsSnapshotColumns,
  formatHistoricalGigTitle,
  normalizeLegacyUsernameToken,
  parseJamsSnapshotSheet,
  parseLegacySeatCell,
  parseSnapshotSheetDate,
} from "@/lib/legacy-jams-snapshot";

describe("legacy jams snapshot parsing", () => {
  it("formats historical gig titles from sheet dates", () => {
    const date = parseSnapshotSheetDate("2026.04.19");

    expect(formatHistoricalGigTitle(date)).toBe("Гиг The Jammers 19 of April 2026");
  });

  it("reads participant columns only before Additional Tool 1 while preserving Originator", () => {
    const columns = detectJamsSnapshotColumns([
      "Band / Группа",
      "Song / Название",
      "Comments from orgs",
      "Status. Ready: 6",
      "Vocal 1",
      "Guitar 1",
      "Bass",
      "Additional Tool 1",
      "Additional Tool 2",
      "Playback",
      "Tone",
      "Originator",
      "Youtube",
    ]);

    expect(columns.participantColumns.map((column) => column.header)).toEqual([
      "Vocal 1",
      "Guitar 1",
      "Bass",
    ]);
    expect(columns.originatorColumnIndex).toBe(11);
  });

  it("normalizes usernames case-insensitively without preserving at-prefixes", () => {
    expect(normalizeLegacyUsernameToken(" @PoliaOlia ")).toBe("poliaolia");
    expect(normalizeLegacyUsernameToken("@MusicAndreevDenisS")).toBe("musicandreevdeniss");
    expect(normalizeLegacyUsernameToken("@vanyagaymerass")).toBe("vanyagaymer");
    expect(normalizeLegacyUsernameToken("@loremipsum9900")).toBeNull();
  });

  it("does not turn optional placeholders into users", () => {
    expect(parseLegacySeatCell("optional")).toMatchObject({
      status: "OPEN",
      isOptional: true,
      username: null,
    });
    expect(parseLegacySeatCell("N/A")).toMatchObject({
      status: "UNAVAILABLE",
      isOptional: false,
      username: null,
    });
  });

  it("parses rows into historical tracks without Additional Tool seats", () => {
    const event = parseJamsSnapshotSheet("2026.04.19", [
      [
        "Band / Группа",
        "Song / Название",
        "Comments from orgs",
        "Status. Ready: 6",
        "Vocal 1",
        "Guitar 1",
        "Additional Tool 1",
        "Originator",
      ],
      [
        "Radiohead",
        "Just",
        "",
        "0.Ready!",
        "@StreetSp1r1t",
        "@ProTrader9000",
        "@ignored_tool",
        "@ProTrader9000",
      ],
    ]);

    expect(event.title).toBe("Гиг The Jammers 19 of April 2026");
    expect(event.tracks).toHaveLength(1);
    expect(event.tracks[0]).toMatchObject({
      artistName: "Radiohead",
      songTitle: "Just",
      originatorUsername: "protrader9000",
    });
    expect(event.tracks[0]?.seats.map((seat) => seat.username)).toEqual([
      "streetsp1r1t",
      "protrader9000",
    ]);
  });
});
