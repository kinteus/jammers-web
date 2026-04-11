import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_SET_TRACK_COUNT,
  getEffectiveMaxSetTrackCount,
} from "@/lib/domain/setlist-limit";

describe("setlist limit compatibility", () => {
  it("falls back to default when no value exists", () => {
    expect(getEffectiveMaxSetTrackCount(null)).toBe(DEFAULT_MAX_SET_TRACK_COUNT);
    expect(getEffectiveMaxSetTrackCount(undefined)).toBe(DEFAULT_MAX_SET_TRACK_COUNT);
  });

  it("keeps direct track counts unchanged", () => {
    expect(getEffectiveMaxSetTrackCount(24)).toBe(24);
    expect(getEffectiveMaxSetTrackCount(1)).toBe(1);
  });

  it("converts legacy minute budgets into track counts", () => {
    expect(getEffectiveMaxSetTrackCount(120)).toBe(24);
    expect(getEffectiveMaxSetTrackCount(75)).toBe(15);
  });
});
