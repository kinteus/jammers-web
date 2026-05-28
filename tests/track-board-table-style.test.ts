import { TrackSeatStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

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

  it("keeps the invite user picker below the sticky table header", () => {
    const layout = getInvitePopoverLayout({
      align: "end",
      preferAbove: false,
      stickyTopBoundary: 132,
      triggerRect: {
        bottom: 110,
        left: 140,
        right: 172,
        top: 78,
      },
      viewportHeight: 760,
      viewportWidth: 960,
    });

    expect(layout.top).toBeGreaterThanOrEqual(132);
  });

  it("lets long boards grow with the page instead of scrolling inside a fixed-height panel", () => {
    const source = readFileSync("src/components/track-board-table.tsx", "utf8");

    expect(source).not.toContain("max-h-[calc(100vh-8rem)]");
    expect(source).not.toContain("overflow-auto");
    expect(source).toContain("overflow-x-auto");
  });

  it("renders track settings popovers outside the table scroll clipping context", () => {
    const source = readFileSync("src/components/track-board-table.tsx", "utf8");

    expect(source).toContain("settingsPopoverLayout");
    expect(source).toContain("\"fixed z-50");
    expect(source).not.toContain("isInline ? \"mt-2\" : \"absolute right-0 top-7 w-72\"");
  });
});
