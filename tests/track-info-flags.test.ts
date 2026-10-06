import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRACK_INFO_FIELDS,
  formatTrackInfoFieldsForTextarea,
  getEventTrackInfoFields,
  getTrackInfoKeys,
  getTrackInfoLabel,
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

  it("localizes playback including legacy Russian keys", () => {
    for (const key of ["playback", "плейбэк", "плейбек"]) {
      expect(getTrackInfoLabel({ key, label: "Плейбэк" }, "en")).toBe("Playback");
      expect(getTrackInfoLabel({ key, label: "Плейбэк" }, "ru")).toBe("Плейбэк");
    }
  });

  it("preserves stable keys and custom translations through admin editing", () => {
    const fields = parseTrackInfoFieldsInput("Плейбэк|playback\nАкустика|acoustic|Acoustic|Акустика");
    const reloaded = getEventTrackInfoFields(serializeTrackInfoFields(fields));
    expect(parseTrackInfoFieldsInput(formatTrackInfoFieldsForTextarea(reloaded))).toEqual(fields);
    expect(getTrackInfoLabel(reloaded[1], "en")).toBe("Acoustic");
    expect(getTrackInfoLabel(reloaded[1], "ru")).toBe("Акустика");
    expect(getTrackInfoLabel({ key: "custom", label: "Custom" }, "en")).toBe("Custom");
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
      "Lead Vox|lead-vocals",
    );

    const serializedKeys = serializeTrackInfoKeys(["Playback", "lead-vocals", "playback"]);
    expect(parseTrackInfoKeys(serializedKeys)).toEqual(["playback", "lead-vocals"]);
    expect(getTrackInfoKeys(null, true)).toEqual(["playback"]);
  });
});
