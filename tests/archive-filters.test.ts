import { describe, expect, it } from "vitest";

import { buildArchiveQueryString } from "@/components/archive-filters";

describe("buildArchiveQueryString", () => {
  it("keeps only non-empty filters so URLs stay clean and shareable", () => {
    expect(buildArchiveQueryString({ query: "  Muse ", year: "" })).toBe("q=Muse");
    expect(buildArchiveQueryString({ query: "", year: "2025" })).toBe("year=2025");
    expect(buildArchiveQueryString({ query: "", year: "" })).toBe("");
  });
});
