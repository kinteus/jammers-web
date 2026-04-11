import { describe, expect, it } from "vitest";

import { assertEventRegistrationWindow } from "@/lib/domain/event-registration";

describe("event registration window", () => {
  it("accepts a valid registration window", () => {
    expect(() =>
      assertEventRegistrationWindow({
        registrationClosesAt: new Date("2026-05-01T18:00:00.000Z"),
        registrationOpensAt: new Date("2026-04-25T18:00:00.000Z"),
        startsAt: new Date("2026-05-01T20:00:00.000Z"),
      }),
    ).not.toThrow();
  });

  it("rejects a window where registration start is after close", () => {
    expect(() =>
      assertEventRegistrationWindow({
        registrationClosesAt: new Date("2026-05-01T18:00:00.000Z"),
        registrationOpensAt: new Date("2026-05-01T19:00:00.000Z"),
        startsAt: new Date("2026-05-01T20:00:00.000Z"),
      }),
    ).toThrow(/earlier than registration close/);
  });

  it("rejects a window where registration closes after the gig starts", () => {
    expect(() =>
      assertEventRegistrationWindow({
        registrationClosesAt: new Date("2026-05-01T21:00:00.000Z"),
        registrationOpensAt: new Date("2026-04-25T18:00:00.000Z"),
        startsAt: new Date("2026-05-01T20:00:00.000Z"),
      }),
    ).toThrow(/earlier than the gig start/);
  });
});
