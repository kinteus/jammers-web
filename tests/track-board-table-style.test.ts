import { TrackSeatStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  getInvitePopoverLayout,
  getSeatCellClass,
  getTrackRowBackgroundClass,
} from "@/components/track-board-table";

describe("track board table styling", () => {
  it("keeps non-self seat cells neutral across seat statuses", () => {
    expect(getSeatCellClass(TrackSeatStatus.OPEN, false)).toBe(getSeatCellClass(TrackSeatStatus.CLAIMED, false));
    expect(getSeatCellClass(TrackSeatStatus.OPEN, true)).toBe(getSeatCellClass(TrackSeatStatus.UNAVAILABLE, false));
    expect(getSeatCellClass(TrackSeatStatus.OPEN, false)).not.toContain("bg-gold");
    expect(getSeatCellClass(TrackSeatStatus.CLAIMED, false)).not.toContain("bg-blue");
  });

  it("highlights only the current user's own seat cells", () => {
    expect(getSeatCellClass(TrackSeatStatus.CLAIMED, false, true)).toContain("bg-blue");
    expect(getSeatCellClass(TrackSeatStatus.CLAIMED, false, true)).toContain("ring-blue");
  });

  it("does not color the entire row just because the current user is in the song", () => {
    expect(getTrackRowBackgroundClass({ index: 1, isMyTrack: true, isReady: false })).not.toContain("bg-blue");
    expect(getTrackRowBackgroundClass({ index: 1, isMyTrack: true, isReady: true })).toContain("bg-emerald");
  });

  it("keeps the invite user picker inside a narrow mobile viewport", () => {
    const layout = getInvitePopoverLayout({
      align: "end",
      preferAbove: false,
      triggerRect: {
        bottom: 560,
        left: 340,
        right: 372,
        top: 528,
      },
      viewportHeight: 640,
      viewportWidth: 390,
    });

    expect(layout.left).toBeGreaterThanOrEqual(12);
    expect(layout.left + layout.width).toBeLessThanOrEqual(378);
    expect(layout.top).toBeGreaterThanOrEqual(12);
    expect(layout.top + layout.maxHeight).toBeLessThanOrEqual(628);
  });
});
