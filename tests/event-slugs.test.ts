import { describe, expect, it } from "vitest";

import {
  buildEventSlugLookupCandidates,
  getEventRouteSlug,
  transliterateToAscii,
} from "@/lib/event-slugs";

describe("event slug helpers", () => {
  it("transliterates cyrillic strings into ascii route slugs", () => {
    expect(transliterateToAscii("Самый лучший гиг")).toBe("samyi luchshii gig");
    expect(getEventRouteSlug("Самый лучший гиг")).toBe("samyi-luchshii-gig");
  });

  it("builds tolerant lookup candidates for stored and route slugs", () => {
    const candidates = buildEventSlugLookupCandidates(
      "%D0%A1%D0%B0%D0%BC%D1%8B%D0%B9-%D0%BB%D1%83%D1%87%D1%88%D0%B8%D0%B9-%D0%B3%D0%B8%D0%B3",
    );

    expect(candidates).toContain("Самый-лучший-гиг");
    expect(candidates).toContain("samyi-luchshii-gig");
  });
});
