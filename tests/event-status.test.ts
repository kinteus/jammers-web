import { EventStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  allowsClosedOptionalSeatRequests,
  getAutoSyncedEventStatus,
  getEffectiveEventStatus,
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

  it("allows optional-seat requests only after registration closes and before the gig starts", () => {
    expect(
      allowsClosedOptionalSeatRequests({
        status: EventStatus.CLOSED,
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
});
