import { EventStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  allowsClosedOptionalSeatRequests,
  getAllowedNextEventStatuses,
  getAutoSyncedEventStatus,
  getEffectiveEventStatus,
  getEventAudienceState,
  isEventOpen,
} from "@/lib/domain/event-status";

describe("event status lifecycle", () => {
  it("opens a draft event once registration starts", () => {
    const event = {
      status: EventStatus.DRAFT,
      registrationClosesAt: new Date(Date.now() + 60_000),
      registrationOpensAt: new Date(Date.now() - 60_000),
    };

    expect(getEffectiveEventStatus(event)).toBe(EventStatus.OPEN);
    expect(getAutoSyncedEventStatus(event)).toBe(EventStatus.OPEN);
    expect(isEventOpen(event)).toBe(true);
  });

  it("closes an open event once registration ends", () => {
    const event = {
      status: EventStatus.OPEN,
      registrationClosesAt: new Date(Date.now() - 60_000),
      registrationOpensAt: new Date(Date.now() - 3_600_000),
    };

    expect(getEffectiveEventStatus(event)).toBe(EventStatus.CLOSED);
    expect(getAutoSyncedEventStatus(event)).toBe(EventStatus.CLOSED);
    expect(isEventOpen(event)).toBe(false);
  });

  it("allows optional-seat requests only after the final set is published and before the gig starts", () => {
    expect(
      allowsClosedOptionalSeatRequests({
        status: EventStatus.CLOSED,
        registrationClosesAt: new Date(Date.now() - 60_000),
        registrationOpensAt: new Date(Date.now() - 3_600_000),
        startsAt: new Date(Date.now() + 86_400_000),
      }),
    ).toBe(false);

    expect(
      allowsClosedOptionalSeatRequests({
        status: EventStatus.PUBLISHED,
        registrationClosesAt: new Date(Date.now() - 60_000),
        registrationOpensAt: new Date(Date.now() - 3_600_000),
        startsAt: new Date(Date.now() + 86_400_000),
      }),
    ).toBe(true);

    expect(
      allowsClosedOptionalSeatRequests({
        status: EventStatus.PUBLISHED,
        registrationClosesAt: new Date(Date.now() - 60_000),
        registrationOpensAt: new Date(Date.now() - 3_600_000),
        startsAt: new Date(Date.now() - 1_000),
      }),
    ).toBe(false);
  });

  it("does not expose curating as an explicit next admin status", () => {
    expect(getAllowedNextEventStatuses(EventStatus.CLOSED)).toEqual([EventStatus.PUBLISHED]);
    expect(getAllowedNextEventStatuses(EventStatus.OPEN)).toEqual([EventStatus.CLOSED]);
  });

  it("marks a published gig as live after start and archived after the next local midnight", () => {
    const startsAt = new Date("2026-05-01T19:30:00.000Z");

    expect(
      getEventAudienceState({
        status: EventStatus.PUBLISHED,
        startsAt,
        now: new Date("2026-05-01T20:00:00.000Z"),
      }),
    ).toBe("LIVE");

    expect(
      getEventAudienceState({
        status: EventStatus.PUBLISHED,
        startsAt,
        now: new Date("2026-05-02T00:00:00.000Z"),
      }),
    ).toBe("ARCHIVED");
  });
});
