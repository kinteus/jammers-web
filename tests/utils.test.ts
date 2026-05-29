import { describe, expect, it } from "vitest";

import { buildSlugLookupCandidates, formatDateTime, slugify } from "@/lib/utils";

describe("formatDateTime", () => {
  it("renders timestamps in the Cyprus event timezone regardless of server timezone", () => {
    // 10:00 UTC is 13:00 in Cyprus summer time (Europe/Nicosia, UTC+3).
    expect(formatDateTime("2026-05-29T10:00:00.000Z")).toBe("29 May 2026, 13:00");
  });

  it("keeps the Cyprus wall time in the ru locale", () => {
    expect(formatDateTime("2026-05-29T10:00:00.000Z", "ru")).toContain("13:00");
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
