/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { fireEvent } from "@testing-library/react";
import { TrackSeatStatus } from "@prisma/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AdminSetlistStack,
  reorderSetlistCluster,
  reorderSetlistItems,
} from "@/components/admin-setlist-stack";

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
    originatorLabel: "@anna",
    playbackRequired: false,
    seats: [
      {
        label: "Vocal 1",
        status: TrackSeatStatus.CLAIMED,
        isOptional: false,
        user: { fullName: "Anna Vocal", telegramUsername: "anna_vocal" },
      },
      {
        label: "Guitar 1",
        status: TrackSeatStatus.OPEN,
        isOptional: true,
        user: null,
      },
    ],
  },
  {
    id: "item-2",
    title: "Second Song",
    artistName: "Second Artist",
    lineupSummary: "B",
    orderIndex: 2,
    comment: "Needs shorter ending",
    originatorLabel: "@mike",
    playbackRequired: true,
    seats: [
      {
        label: "Drums",
        status: TrackSeatStatus.CLAIMED,
        isOptional: false,
        user: { fullName: "Mike Drums", telegramUsername: "mike_drums" },
      },
      {
        label: "Bass",
        status: TrackSeatStatus.UNAVAILABLE,
        isOptional: false,
        user: null,
      },
    ],
  },
  {
    id: "item-3",
    title: "Third Song",
    artistName: "Third Artist",
    lineupSummary: "C",
    orderIndex: 3,
    originatorLabel: "@zoe",
    playbackRequired: false,
    seats: [],
  },
];

const drummerClusterItems = [
  {
    id: "item-1",
    title: "First Song",
    artistName: "First Artist",
    lineupSummary: "A",
    orderIndex: 1,
    drummerLabel: "Drums: @anna",
  },
  {
    id: "item-2",
    title: "Second Song",
    artistName: "Second Artist",
    lineupSummary: "B",
    orderIndex: 2,
    drummerLabel: "Drums: @anna",
  },
  {
    id: "item-3",
    title: "Third Song",
    artistName: "Third Artist",
    lineupSummary: "C",
    orderIndex: 3,
    drummerLabel: "Drums: @mike",
  },
  {
    id: "item-4",
    title: "Fourth Song",
    artistName: "Fourth Artist",
    lineupSummary: "D",
    orderIndex: 4,
    drummerLabel: "Drums: @mike",
  },
  {
    id: "item-5",
    title: "Fifth Song",
    artistName: "Fifth Artist",
    lineupSummary: "E",
    orderIndex: 5,
    drummerLabel: "Drums: @zoe",
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

  it("does not expose drag and drop handles on setlist cards", async () => {
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

    expect(host.querySelector("[draggable='true']")).toBeNull();
    expect(host.querySelector("[data-drag-handle]")).toBeNull();
  });

  it("uses song titles as YouTube links", async () => {
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

    const link = host.querySelector<HTMLAnchorElement>('a[href*="youtube.com/results"]');
    expect(link?.textContent).toContain("First Artist - First Song");
    expect(link?.href).toContain("search_query=First%20Artist%20First%20Song");
  });

  it("keeps main-set order as a local draft until save is clicked", async () => {
    reorderSetlistSectionActionMock.mockResolvedValue(undefined);
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <AdminSetlistStack
          deferOrderSave
          emptyLabel="Empty"
          eventId="event-1"
          eventSlug="spring-jam-night"
          items={items}
          moveLabel="Send to backlog"
          movePendingLabel="Moving"
          saveOrderLabel="Save order"
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

    expect(reorderSetlistSectionActionMock).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Unsaved order");

    await act(async () => {
      fireEvent.click(host.querySelector<HTMLButtonElement>('button[aria-label="Save Main set order"]')!);
    });

    const formData = reorderSetlistSectionActionMock.mock.calls[0]?.[0] as FormData;
    expect(JSON.parse(String(formData.get("itemIds")))).toEqual(["item-2", "item-1", "item-3"]);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("labels contiguous drummer clusters without changing the track controls", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <AdminSetlistStack
          emptyLabel="Empty"
          eventId="event-1"
          eventSlug="spring-jam-night"
          items={drummerClusterItems}
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

    expect(host.textContent).toContain("Drums: @anna · 2 songs");
    expect(host.textContent).toContain("Drums: @mike · 2 songs");
    expect(host.querySelector('button[aria-label="Move Second Artist - Second Song up"]')).not.toBeNull();
  });

  it("reorders whole drummer clusters up and down", () => {
    expect(reorderSetlistCluster(drummerClusterItems, 0, "down").map((item) => item.id)).toEqual([
      "item-3",
      "item-4",
      "item-1",
      "item-2",
      "item-5",
    ]);
    expect(reorderSetlistCluster(drummerClusterItems, 2, "up").map((item) => item.id)).toEqual([
      "item-3",
      "item-4",
      "item-1",
      "item-2",
      "item-5",
    ]);
    expect(reorderSetlistCluster(drummerClusterItems, 0, "up")).toBe(drummerClusterItems);
  });

  it("saves multiple drummer cluster moves as one order payload", async () => {
    reorderSetlistSectionActionMock.mockResolvedValue(undefined);
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <AdminSetlistStack
          deferOrderSave
          emptyLabel="Empty"
          eventId="event-1"
          eventSlug="spring-jam-night"
          items={drummerClusterItems}
          moveLabel="Send to backlog"
          movePendingLabel="Moving"
          saveOrderLabel="Save order"
          savingLabel="Saving"
          section="MAIN"
          sectionLabel="Main"
          targetSection="BACKLOG"
          title="Main set"
        />,
      );
    });

    await act(async () => {
      fireEvent.click(host.querySelector<HTMLButtonElement>('button[aria-label="Move Drums: @anna cluster down"]')!);
    });
    await act(async () => {
      fireEvent.click(host.querySelector<HTMLButtonElement>('button[aria-label="Move Drums: @anna cluster down"]')!);
    });

    expect(reorderSetlistSectionActionMock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(host.querySelector<HTMLButtonElement>('button[aria-label="Save Main set order"]')!);
    });

    const formData = reorderSetlistSectionActionMock.mock.calls[0]?.[0] as FormData;
    expect(JSON.parse(String(formData.get("itemIds")))).toEqual([
      "item-3",
      "item-4",
      "item-5",
      "item-1",
      "item-2",
    ]);
    expect(formData.get("section")).toBe("MAIN");
  });

  it("exports the current draft main set to CSV", async () => {
    const createObjectUrlMock = vi.fn<(blob: Blob) => string>(() => "blob:csv");
    const revokeObjectUrlMock = vi.fn();
    const clickMock = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickMock);

    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <AdminSetlistStack
          deferOrderSave
          emptyLabel="Empty"
          eventId="event-1"
          eventSlug="spring-jam-night"
          exportCsvLabel="Export CSV"
          items={items}
          moveLabel="Send to backlog"
          movePendingLabel="Moving"
          saveOrderLabel="Save order"
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
    await act(async () => {
      fireEvent.click(host.querySelector<HTMLButtonElement>('button[aria-label="Export Main set CSV"]')!);
    });

    const blob = createObjectUrlMock.mock.calls[0]?.[0] as Blob;
    const csv = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });

    expect(csv.split("\n")[0]).toBe(
      "id,Band,Song,Comments from orgs,Status,Vocal 1,Vocal 2,Vocal 3,Guitar 1,Guitar 2,Bass,Drums,Keyboard,Additional Tool 1,Additional Tool 2,PB,Tone,Originator,Next Song,Cover (url),Duration (мс)",
    );
    expect(csv).toContain("1,Second Artist,Second Song,Needs shorter ending,,,,,,,,@mike_drums,,,,yes,,@mike,2,,");
    expect(csv).toContain("2,First Artist,First Song,,,@anna_vocal,,,,,,,,,,,,@anna,3,,");
    expect(csv).toContain("3,Third Artist,Third Song,,,,,,,,,,,,,,,@zoe,,,");
    expect(clickMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:csv");
  });
});
