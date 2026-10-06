/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTrackEditor } from "@/components/admin-track-editor";
import { AdminSongWorkspace } from "@/components/admin-song-workspace";
import { AdminSetlistStack } from "@/components/admin-setlist-stack";

const reorder = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/actions", () => ({
  moveSetlistItemAction: vi.fn(), reorderSetlistSectionAction: reorder,
  adminClearSeatAction: vi.fn(), adminReplaceTrackSongAction: vi.fn(), cancelTrackAction: vi.fn(),
  updateTrackSettingsAction: vi.fn(), adminAssignSeatAction: vi.fn(),
}));
beforeEach(() => { vi.stubGlobal("React", React); reorder.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(section: "MAIN" | "UNSELECTED" = "MAIN") {
  const items = ["Alpha", "Beta"].map((title, index) => ({
    id: `item-${index}`, trackId: `track-${index}`, title, artistName: "Band", orderIndex: index + 1,
    lineupSummary: index === 0 ? "Bass: @alice" : "Drums: @bob",
    editor: <details><summary>Edit {title}</summary><input aria-label={`${title} notes`} defaultValue="" /></details>,
  }));
  return render(<AdminSongWorkspace locale="en" counts={{ main: 2, backlog: 0, unselected: 0 }}>
    <AdminSetlistStack items={items} section={section} eventId="event" eventSlug="event" emptyLabel="Empty"
      moveLabel="Send to backlog" movePendingLabel="Moving" savingLabel="Saving" sectionLabel="Main"
      targetSection="BACKLOG" title="Main set" deferOrderSave={section === "MAIN"} saveOrderLabel="Save order" />
  </AdminSongWorkspace>);
}

describe("unified admin song workspace", () => {
  it("finds songs and musicians without losing editor input or enabling ambiguous reordering", () => {
    const { container } = setup();
    fireEvent.change(screen.getByLabelText("Alpha notes"), { target: { value: "Keep this draft" } });
    fireEvent.change(screen.getByLabelText("Find a song or musician"), { target: { value: "@bob" } });
    expect(container.querySelector('[data-song-row="track-0"]')?.hasAttribute("hidden")).toBe(true);
    expect(container.querySelector('[data-song-row="track-1"]')?.hasAttribute("hidden")).toBe(false);
    expect((screen.getByRole("button", { name: "Move Band - Beta up" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Find a song or musician"), { target: { value: "missing" } });
    expect(screen.getByText("No matching songs in this section.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Find a song or musician"), { target: { value: "" } });
    expect((screen.getByLabelText("Alpha notes") as HTMLInputElement).value).toBe("Keep this draft");
    expect(reorder).not.toHaveBeenCalled();
  });

  it("keeps the editor with its song after reordering and allows discarding the order", () => {
    const { container } = setup();
    fireEvent.change(screen.getByLabelText("Alpha notes"), { target: { value: "Keep with Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Move Band - Alpha down" }));
    const rows = container.querySelectorAll('[data-song-row]');
    expect(rows[0].getAttribute("data-song-row")).toBe("track-1");
    expect(rows[1].querySelector<HTMLInputElement>('input[aria-label="Alpha notes"]')?.value).toBe("Keep with Alpha");
    expect(rows[1].querySelector('fieldset')?.disabled).toBe(true);
    expect((screen.getAllByRole("button", { name: "Send to backlog" })[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Discard order changes" }));
    expect(container.querySelector('[data-song-row]')?.getAttribute("data-song-row")).toBe("track-0");
    expect(container.querySelector('fieldset')?.disabled).toBe(false);
    expect(reorder).not.toHaveBeenCalled();
  });

  it("retains an unsaved draft and shows recoverable feedback when saving fails", async () => {
    reorder.mockRejectedValueOnce(new Error("Lock expired"));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Move Band - Alpha down" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Main set order" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Could not save"));
    expect(screen.getByText("Unsaved order")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save Main set order" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps not-selected songs editable without setlist-only actions", () => {
    const { container } = setup("UNSELECTED");
    expect(container.querySelectorAll('[data-song-row]')).toHaveLength(2);
    expect(screen.getByText("Edit Alpha")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Move Band/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send to backlog" })).toBeNull();
  });
});


describe("inline song editor", () => {
  it("loads all editing functions on demand and retains notes when collapsed", async () => {
    const track = {
      id: "track", songId: "song", comment: "Original note", playbackRequired: true, trackInfoKeysJson: null,
      song: { title: "Alpha" }, proposedBy: { telegramUsername: "alice", fullName: "Alice" },
      seats: [
        { id: "seat-open", label: "Guitar", status: "OPEN", isOptional: true, user: null },
        { id: "seat-claimed", label: "Bass", status: "CLAIMED", isOptional: false, user: { telegramUsername: "bob", fullName: "Bob" } },
      ],
    } as unknown as React.ComponentProps<typeof AdminTrackEditor>["track"];
    const { container } = render(<AdminSongWorkspace locale="en" counts={{ main: 1, backlog: 0, unselected: 0 }}
      songCatalog={[{ id: "song", title: "Alpha", artist: { name: "Band" } }]} assignableUsers={[]}>
      <AdminTrackEditor track={track} event={{ id: "event", allowPlayback: true, trackInfoFieldsJson: null }} locale="en" />
    </AdminSongWorkspace>);
    expect(screen.queryByLabelText("Replacement song")).toBeNull();
    fireEvent.click(screen.getByText("Edit song & seats"));
    await waitFor(() => expect(screen.getByLabelText("Replacement song")).toBeTruthy());
    for (const name of ["Replace song", "Delete track", "Save track settings", "Clear seat"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByLabelText("Search registered musicians")).toBeTruthy();
    expect(screen.getByLabelText("Guitar")).toBeTruthy();
    expect(screen.getByLabelText("Playback")).toBeTruthy();
    const notes = screen.getByLabelText("Track notes") as HTMLTextAreaElement;
    expect(new FormData(notes.form!).get("trackId")).toBe("track");
    fireEvent.change(notes, { target: { value: "Draft to keep" } });
    fireEvent.click(screen.getByText("Edit song & seats"));
    fireEvent.click(screen.getByText("Edit song & seats"));
    expect((screen.getByLabelText("Track notes") as HTMLTextAreaElement).value).toBe("Draft to keep");
    expect(container.querySelectorAll("form form")).toHaveLength(0);
  });
});
