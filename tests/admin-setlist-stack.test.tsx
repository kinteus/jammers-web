/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { fireEvent } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminSetlistStack, reorderSetlistItems } from "@/components/admin-setlist-stack";

const refreshMock = vi.hoisted(() => vi.fn());
const reorderSetlistSectionActionMock = vi.hoisted(() => vi.fn());
const moveSetlistItemActionMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("@/server/actions", () => ({
  moveSetlistItemAction: moveSetlistItemActionMock,
  reorderSetlistSectionAction: reorderSetlistSectionActionMock,
}));

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const items = [
  {
    id: "item-1",
    title: "First Song",
    artistName: "First Artist",
    lineupSummary: "A",
    orderIndex: 1,
  },
  {
    id: "item-2",
    title: "Second Song",
    artistName: "Second Artist",
    lineupSummary: "B",
    orderIndex: 2,
  },
  {
    id: "item-3",
    title: "Third Song",
    artistName: "Third Artist",
    lineupSummary: "C",
    orderIndex: 3,
  },
];

describe("AdminSetlistStack", () => {
  it("reorders setlist items up and down without drag and drop", () => {
    expect(reorderSetlistItems(items, "item-2", "up").map((item) => item.id)).toEqual([
      "item-2",
      "item-1",
      "item-3",
    ]);
    expect(reorderSetlistItems(items, "item-2", "down").map((item) => item.id)).toEqual([
      "item-1",
      "item-3",
      "item-2",
    ]);
  });

  it("persists order when an admin uses the move-up control", async () => {
    reorderSetlistSectionActionMock.mockResolvedValue(undefined);
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <AdminSetlistStack
          emptyLabel="Empty"
          eventId="event-1"
          eventSlug="spring-jam-night"
          items={items}
          moveLabel="Send to backlog"
          movePendingLabel="Moving"
          savingLabel="Saving"
          section="MAIN"
          sectionLabel="Main"
          targetSection="BACKLOG"
          title="Main set"
        />,
      );
    });

    await act(async () => {
      fireEvent.click(host.querySelector<HTMLButtonElement>('button[aria-label="Move Second Artist - Second Song up"]')!);
    });

    const formData = reorderSetlistSectionActionMock.mock.calls[0]?.[0] as FormData;
    expect(JSON.parse(String(formData.get("itemIds")))).toEqual(["item-2", "item-1", "item-3"]);
    expect(formData.get("section")).toBe("MAIN");
  });
});
