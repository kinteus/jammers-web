import { describe, expect, it } from "vitest";

import { resolveLatestSetlistHref } from "@/lib/public-setlist-link";

describe("resolveLatestSetlistHref", () => {
  it("prefers the latest published event", () => {
    expect(
      resolveLatestSetlistHref({
        publishedEvents: [
          { id: "published-1", startsAt: new Date("2026-04-25T18:00:00.000Z") },
        ],
        currentEvents: [{ id: "open-1", startsAt: new Date("2026-05-05T18:00:00.000Z") }],
      }),
    ).toBe("/events/published-1");
  });

  it("falls back to the nearest current event and then the home anchor", () => {
    expect(
      resolveLatestSetlistHref({
        publishedEvents: [],
        currentEvents: [{ id: "open-1", startsAt: new Date("2026-05-05T18:00:00.000Z") }],
      }),
    ).toBe("/events/open-1");
    expect(resolveLatestSetlistHref({ publishedEvents: [], currentEvents: [] })).toBe(
      "/#published",
    );
  });
});
