import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRACK_INFO_FIELDS,
  formatTrackInfoFieldsForTextarea,
  getEventTrackInfoFields,
  getTrackInfoKeys,
  parseTrackInfoFieldsInput,
  parseTrackInfoKeys,
  serializeTrackInfoFields,
  serializeTrackInfoKeys,
} from "@/lib/track-info-flags";

describe("track info flags", () => {
  it("parses textarea input into unique normalized flags", () => {
    expect(
      parseTrackInfoFieldsInput("Playback\nPlayback\nLead Vox|lead-vocals"),
    ).toEqual([
      { key: "playback", label: "Playback" },
      { key: "lead-vocals", label: "Lead Vox" },
    ]);
  });

  it("uses fallback playback flag when playback is allowed and no config exists", () => {
    expect(getEventTrackInfoFields(null, true)).toEqual(DEFAULT_TRACK_INFO_FIELDS);
    expect(getEventTrackInfoFields(null, false)).toEqual([]);
  });

  it("round-trips serialized flag definitions and keys", () => {
    const serializedFields = serializeTrackInfoFields([
      { key: "lead-vocals", label: "Lead Vox" },
    ]);
    expect(formatTrackInfoFieldsForTextarea(getEventTrackInfoFields(serializedFields))).toBe(
      "Lead Vox",
    );

    const serializedKeys = serializeTrackInfoKeys(["Playback", "lead-vocals", "playback"]);
    expect(parseTrackInfoKeys(serializedKeys)).toEqual(["playback", "lead-vocals"]);
    expect(getTrackInfoKeys(null, true)).toEqual(["playback"]);
  });
});
