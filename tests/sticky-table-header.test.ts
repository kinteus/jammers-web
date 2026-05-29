import { describe, expect, it } from "vitest";

import { getStickyHeaderTranslateY } from "@/components/track-board-table";

describe("getStickyHeaderTranslateY", () => {
  it("keeps the header in its natural place before the table reaches the sticky offset", () => {
    expect(
      getStickyHeaderTranslateY({
        tableTop: 300,
        tableHeight: 1000,
        theadHeight: 72,
        stickyOffset: 60,
      }),
    ).toBe(0);
  });

  it("floats the header down to the sticky offset once the table scrolls past it", () => {
    expect(
      getStickyHeaderTranslateY({
        tableTop: -100,
        tableHeight: 1000,
        theadHeight: 72,
        stickyOffset: 60,
      }),
    ).toBe(160);
  });

  it("stops floating so the header never leaves the bottom of the table", () => {
    expect(
      getStickyHeaderTranslateY({
        tableTop: -2000,
        tableHeight: 1000,
        theadHeight: 72,
        stickyOffset: 60,
      }),
    ).toBe(928);
  });
});
