import { EventStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  getHomeFeaturedSortTime,
  isHomeFeaturedEventCandidate,
} from "@/lib/domain/home-featured-event";

describe("home featured event selection", () => {
  it("keeps a published gig featured after start until the next local midnight", () => {
    const event = {
      effectiveStatus: EventStatus.PUBLISHED,
      startsAt: new Date("2026-05-26T19:30:00.000Z"),
    };

    expect(
      isHomeFeaturedEventCandidate(event, new Date("2026-05-26T20:30:00.000Z").getTime()),
    ).toBe(true);
  });

  it("removes a published gig from featured after the next local midnight", () => {
    const event = {
      effectiveStatus: EventStatus.PUBLISHED,
      startsAt: new Date("2026-05-26T19:30:00.000Z"),
    };

    expect(
      isHomeFeaturedEventCandidate(event, new Date("2026-05-27T00:00:00.000Z").getTime()),
    ).toBe(false);
  });

  it("sorts a live event before future events while it is still featured", () => {
    const nowMs = new Date("2026-05-26T20:30:00.000Z").getTime();

    expect(
      getHomeFeaturedSortTime(
        {
          effectiveStatus: EventStatus.PUBLISHED,
          startsAt: new Date("2026-05-26T19:30:00.000Z"),
        },
        nowMs,
      ),
    ).toBe(nowMs);
  });
});
