import { describe, expect, it } from "vitest";

import { getTrackBoardEmptyState } from "@/lib/event-board-copy";

describe("event board copy", () => {
  it("distinguishes filtered zero results from an empty gig", () => {
    expect(
      getTrackBoardEmptyState({
        activeView: "all",
        hasFilters: true,
        locale: "ru",
        totalTrackCount: 2,
      }),
    ).toContain("Ничего не найдено");
  });

  it("keeps the true empty gig message when there are no tracks", () => {
    expect(
      getTrackBoardEmptyState({
        activeView: "all",
        hasFilters: false,
        locale: "ru",
        totalTrackCount: 0,
      }),
    ).toBe("В этом гиге пока нет заявленных песен.");
  });
});
