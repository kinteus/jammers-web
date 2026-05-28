import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("event page layout", () => {
  it("shows ready-song count instead of open-player pressure in the hero stats", () => {
    const source = readFileSync("src/app/events/[slug]/page.tsx", "utf8");

    expect(source).toContain("readyTrackCount");
    expect(source).toContain("Songs ready");
    expect(source).toContain("Песен собрано");
    expect(source).not.toContain("Still need players");
  });

  it("keeps the manual song catalog request hidden from the public gig page", () => {
    const source = readFileSync("src/app/events/[slug]/page.tsx", "utf8");

    expect(source).not.toContain("SongCatalogRequestForm");
    expect(source).not.toContain("missing-song-request");
  });

  it("does not render the extra board context and line-up map block", () => {
    const source = readFileSync("src/app/events/[slug]/page.tsx", "utf8");

    expect(source).not.toContain("Board context and line-up map");
    expect(source).not.toContain("Контекст сетлиста и карта лайнапа");
    expect(source).not.toContain("Most needed roles");
    expect(source).not.toContain("Line-up map");
  });
});
