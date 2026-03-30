import { EventStatus, TrackSeatStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  assertEventAllowsChanges,
  assertSeatClaimable,
  assertWithinTrackLimit,
} from "@/lib/domain/rules";

describe("domain rules", () => {
  it("blocks participation when event is closed", () => {
    expect(() =>
      assertEventAllowsChanges({
        status: EventStatus.CLOSED,
        registrationClosesAt: null,
        registrationOpensAt: null,
      }),
    ).toThrow(/locked/);
  });

  it("blocks participation when the close timer has passed even if status is still open", () => {
    expect(() =>
      assertEventAllowsChanges({
        status: EventStatus.OPEN,
        registrationClosesAt: new Date(Date.now() - 60_000),
        registrationOpensAt: new Date(Date.now() - 3_600_000),
      }),
    ).toThrow(/locked/);
  });

  it("prevents claiming unavailable or occupied seats", () => {
    expect(() =>
      assertSeatClaimable({ status: TrackSeatStatus.UNAVAILABLE, userId: null }),
    ).toThrow(/unavailable/);
    expect(() =>
      assertSeatClaimable({ status: TrackSeatStatus.CLAIMED, userId: "user-1" }),
    ).toThrow(/occupied/);
  });

  it("enforces event track limits", () => {
    expect(() => assertWithinTrackLimit(3, 3)).toThrow(/limit/);
    expect(() => assertWithinTrackLimit(1, 3)).not.toThrow();
  });
});
