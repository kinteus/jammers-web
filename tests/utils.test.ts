import { describe, expect, it } from "vitest";

import {
  buildSlugLookupCandidates,
  formatDateTime,
  formatEventDateLong,
  formatEventDateShort,
  formatEventTime,
  slugify,
} from "@/lib/utils";

describe("formatDateTime", () => {
  it("renders timestamps in the Cyprus event timezone regardless of server timezone", () => {
    // 10:00 UTC is 13:00 in Cyprus summer time (Europe/Nicosia, UTC+3).
    expect(formatDateTime("2026-05-29T10:00:00.000Z")).toBe("29 May 2026, 13:00");
  });

  it("keeps the Cyprus wall time in the ru locale", () => {
    expect(formatDateTime("2026-05-29T10:00:00.000Z", "ru")).toContain("13:00");
  });
});

describe("event date helpers", () => {
  // 17:00 UTC on 18 Oct 2026 is 20:00 in Cyprus (UTC+3). Home, archive and gig pages must agree.
  const startsAt = "2026-10-18T17:00:00.000Z";

  it("formats the time in the Cyprus timezone, matching formatDateTime", () => {
    expect(formatEventTime(startsAt)).toBe("20:00");
    expect(formatDateTime(startsAt)).toContain(formatEventTime(startsAt));
  });

  it("uses the Cyprus calendar day near midnight", () => {
    // 22:30 UTC on 17 Oct is already 18 Oct in Cyprus.
    expect(formatEventDateShort("2026-10-17T22:30:00.000Z")).toBe("18 Oct 2026");
  });

  it("uses the same short month in every format (Sep, not Sept)", () => {
    const september = "2026-09-08T17:00:00.000Z";
    expect(formatEventDateShort(september)).toBe("8 Sep 2026");
    expect(formatDateTime(september)).toBe("8 Sep 2026, 20:00");
  });

  it("formats long and short dates in both locales", () => {
    expect(formatEventDateLong(startsAt)).toBe("18 October 2026");
    expect(formatEventDateShort(startsAt)).toBe("18 Oct 2026");
    expect(formatEventDateLong(startsAt, "ru")).toBe("18 октября 2026");
  });
});

describe("slug helpers", () => {
  it("normalizes human-readable unicode slugs into lookup candidates", () => {
    const title = "Самый лучший гиг";
    const storedSlug = `${slugify(title)}-9c52`;
    const humanReadableSlug = "самый-лучший-гиг-9c52";

    expect(buildSlugLookupCandidates(humanReadableSlug)).toContain(storedSlug);
  });

  it("decodes percent-encoded slugs for route lookups", () => {
    const encodedSlug =
      "%D1%81%D0%B0%D0%BC%D1%8B%D0%B8-%D0%BB%D1%83%D1%87%D1%88%D0%B8%D0%B8-%D0%B3%D0%B8%D0%B3-9c52";

    expect(buildSlugLookupCandidates(encodedSlug)).toContain("самыи-лучшии-гиг-9c52");
  });
});
