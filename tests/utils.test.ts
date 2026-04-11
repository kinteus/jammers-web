import { describe, expect, it } from "vitest";

import { buildSlugLookupCandidates, slugify } from "@/lib/utils";

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
