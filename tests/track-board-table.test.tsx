/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { TrackSeatStatus, UserRole } from "@prisma/client";
import { fireEvent } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sortTracksBySeatAvailability, TrackBoardTable } from "@/components/track-board-table";
import { cancelTrackAction } from "@/server/actions";

vi.mock("@/server/actions", () => ({
  cancelTrackAction: vi.fn(),
  claimSeatInlineAction: vi.fn(),
  inviteToSeatAction: vi.fn(),
  inviteToSeatInlineAction: vi.fn(),
  releaseSeatInlineAction: vi.fn(),
  updateTrackSettingsAction: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("TrackBoardTable", () => {
  it("marks fully staffed tracks with row color instead of a duplicate ready badge", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TrackBoardTable
          allowClosedOptionalRequests={true}
          eventSlug="spring-jam-night"
          isOpen={true}
          locale="ru"
          lineupSlots={[
            {
              id: "slot-vocals",
              key: "vocals",
              label: "Vocals",
              seatCount: 1,
              allowOptional: false,
              displayOrder: 1,
            },
            {
              id: "slot-guitar",
              key: "guitar",
              label: "Guitar",
              seatCount: 1,
              allowOptional: true,
              displayOrder: 2,
            },
          ]}
          trackInfoFields={[]}
          tracks={[
            {
              id: "track-ready",
              proposedById: "user-proposer",
              proposedBy: {
                telegramUsername: "proposer",
                fullName: "Proposer",
              },
              song: {
                title: "Fully Ready Song",
                artist: { name: "The Band" },
              },
              playbackRequired: false,
              trackInfoKeysJson: null,
              comment: null,
              seats: [
                {
                  id: "seat-vocals",
                  seatIndex: 1,
                  label: "Vocals",
                  status: TrackSeatStatus.CLAIMED,
                  isOptional: false,
                  userId: "user-vocals",
                  user: {
                    telegramUsername: "singer",
                    fullName: "Singer",
                  },
                  lineupSlotId: "slot-vocals",
                  invites: [],
                },
                {
                  id: "seat-guitar",
                  seatIndex: 1,
                  label: "Guitar",
                  status: TrackSeatStatus.OPEN,
                  isOptional: true,
                  userId: null,
                  user: null,
                  lineupSlotId: "slot-guitar",
                  invites: [],
                },
              ],
            },
          ]}
          user={{
            id: "user-admin",
            role: UserRole.ADMIN,
            telegramUsername: "admin",
            fullName: "Admin",
          }}
        />,
      );
    });

    expect(host.querySelector('[data-readiness="ready"]')).not.toBeNull();
    expect(host.querySelector('[data-ready-badge="primary"]')).toBeNull();
    expect(host.textContent).toContain("Обязательные закрыты");
  });

  it("numbers songs from the stable trackNumbers map instead of the row index", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TrackBoardTable
          allowClosedOptionalRequests={true}
          eventSlug="spring-jam-night"
          isOpen={true}
          locale="ru"
          lineupSlots={[
            {
              id: "slot-vocals",
              key: "vocals",
              label: "Vocals",
              seatCount: 1,
              allowOptional: false,
              displayOrder: 1,
            },
          ]}
          trackInfoFields={[]}
          trackNumbers={{ "track-only": 7 }}
          tracks={[
            {
              id: "track-only",
              proposedById: "user-proposer",
              proposedBy: { telegramUsername: "proposer", fullName: "Proposer" },
              song: { title: "Numbered Song", artist: { name: "The Band" } },
              playbackRequired: false,
              trackInfoKeysJson: null,
              comment: null,
              seats: [
                {
                  id: "seat-vocals",
                  seatIndex: 1,
                  label: "Vocals",
                  status: TrackSeatStatus.OPEN,
                  isOptional: false,
                  userId: null,
                  user: null,
                  lineupSlotId: "slot-vocals",
                  invites: [],
                },
              ],
            },
          ]}
          user={{
            id: "user-admin",
            role: UserRole.ADMIN,
            telegramUsername: "admin",
            fullName: "Admin",
          }}
        />,
      );
    });

    expect(host.textContent).toContain("7.");
    expect(host.textContent).not.toContain("1.");
  });

  it("lets a non-admin proposer delete their own track", async () => {
    vi.mocked(cancelTrackAction).mockReset();
    vi.stubGlobal("confirm", vi.fn(() => true));

    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TrackBoardTable
          allowClosedOptionalRequests={true}
          eventSlug="spring-jam-night"
          isOpen={true}
          locale="en"
          lineupSlots={[
            {
              id: "slot-vocals",
              key: "vocals",
              label: "Vocals",
              seatCount: 1,
              allowOptional: false,
              displayOrder: 1,
            },
          ]}
          trackInfoFields={[]}
          tracks={[
            {
              id: "track-mine",
              proposedById: "user-proposer",
              proposedBy: { telegramUsername: "proposer", fullName: "Proposer" },
              song: { title: "My Song", artist: { name: "My Band" } },
              playbackRequired: false,
              trackInfoKeysJson: null,
              comment: null,
              seats: [
                {
                  id: "seat-vocals",
                  seatIndex: 1,
                  label: "Vocals",
                  status: TrackSeatStatus.CLAIMED,
                  isOptional: false,
                  userId: "user-proposer",
                  user: { telegramUsername: "proposer", fullName: "Proposer" },
                  lineupSlotId: "slot-vocals",
                  invites: [],
                },
              ],
            },
          ]}
          user={{
            id: "user-proposer",
            role: UserRole.USER,
            telegramUsername: "proposer",
            fullName: "Proposer",
          }}
        />,
      );
    });

    const deleteButton = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete My Song"]',
    );
    expect(deleteButton).not.toBeNull();

    await act(async () => {
      deleteButton?.closest("form")?.requestSubmit(deleteButton ?? undefined);
    });

    expect(cancelTrackAction).toHaveBeenCalledTimes(1);
  });

  it("renders playback as a readonly table column outside the claimable seats", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TrackBoardTable
          allowClosedOptionalRequests={true}
          eventSlug="spring-jam-night"
          isOpen={true}
          locale="ru"
          lineupSlots={[
            {
              id: "slot-vocals",
              key: "vocals",
              label: "Vocals",
              seatCount: 1,
              allowOptional: false,
              displayOrder: 1,
            },
          ]}
          trackInfoFields={[{ key: "playback", label: "Плейбэк" }]}
          tracks={[
            {
              id: "track-playback",
              proposedById: "user-proposer",
              proposedBy: {
                telegramUsername: "proposer",
                fullName: "Proposer",
              },
              song: {
                title: "Playback Song",
                artist: { name: "The Band" },
              },
              playbackRequired: true,
              trackInfoKeysJson: '["playback"]',
              comment: null,
              seats: [
                {
                  id: "seat-vocals",
                  seatIndex: 1,
                  label: "Vocals",
                  status: TrackSeatStatus.OPEN,
                  isOptional: false,
                  userId: null,
                  user: null,
                  lineupSlotId: "slot-vocals",
                  invites: [],
                },
              ],
            },
          ]}
          user={{
            id: "user-admin",
            role: UserRole.ADMIN,
            telegramUsername: "admin",
            fullName: "Admin",
          }}
        />,
      );
    });

    const playbackCell = host.querySelector('[data-playback-cell="track-playback"]');
    expect(playbackCell?.textContent).toContain("Да");
    expect(playbackCell?.querySelector("button, form")).toBeNull();
    expect(host.querySelectorAll("thead th")).toHaveLength(4);
  });

  it("sorts tracks by a selected desktop seat column availability", () => {
    const tracks = [
      {
        id: "occupied-track",
        seats: [
          {
            lineupSlotId: "slot-bass",
            seatIndex: 1,
            status: TrackSeatStatus.CLAIMED,
          },
        ],
      },
      {
        id: "open-track",
        seats: [
          {
            lineupSlotId: "slot-bass",
            seatIndex: 1,
            status: TrackSeatStatus.OPEN,
          },
        ],
      },
      {
        id: "unavailable-track",
        seats: [
          {
            lineupSlotId: "slot-bass",
            seatIndex: 1,
            status: TrackSeatStatus.UNAVAILABLE,
          },
        ],
      },
    ];

    expect(
      sortTracksBySeatAvailability(tracks, {
        direction: "open-first",
        seatIndex: 1,
        slotId: "slot-bass",
      }).map((track) => track.id),
    ).toEqual(["open-track", "occupied-track", "unavailable-track"]);
    expect(
      sortTracksBySeatAvailability(tracks, {
        direction: "occupied-first",
        seatIndex: 1,
        slotId: "slot-bass",
      }).map((track) => track.id),
    ).toEqual(["occupied-track", "open-track", "unavailable-track"]);
  });

  it("lets the track proposer edit public track settings from the board", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TrackBoardTable
          allowClosedOptionalRequests={false}
          eventSlug="spring-jam-night"
          isOpen={true}
          locale="ru"
          lineupSlots={[
            {
              id: "slot-guitar",
              key: "guitar",
              label: "Guitar",
              seatCount: 1,
              allowOptional: true,
              displayOrder: 1,
            },
          ]}
          trackInfoFields={[{ key: "chart", label: "Ноты" }]}
          tracks={[
            {
              id: "track-owned",
              proposedById: "user-proposer",
              proposedBy: {
                telegramUsername: "proposer",
                fullName: "Proposer",
              },
              song: {
                title: "Owned Song",
                artist: { name: "The Band" },
              },
              playbackRequired: false,
              trackInfoKeysJson: null,
              comment: "Old note",
              seats: [
                {
                  id: "seat-guitar",
                  seatIndex: 1,
                  label: "Guitar",
                  status: TrackSeatStatus.OPEN,
                  isOptional: true,
                  userId: null,
                  user: null,
                  lineupSlotId: "slot-guitar",
                  invites: [],
                },
              ],
            },
          ]}
          user={{
            id: "user-proposer",
            role: UserRole.USER,
            telegramUsername: "proposer",
            fullName: "Proposer",
          }}
        />,
      );
    });

    expect(host.textContent).toContain("Сохранить настройки трека");
    expect(host.querySelector('textarea[name="comment"]')).not.toBeNull();
    expect(host.querySelector('input[name="optionalSeatIds"][value="seat-guitar"]')).not.toBeNull();
  });

  it("closes the desktop track settings popover when clicking outside it", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TrackBoardTable
          allowClosedOptionalRequests={false}
          eventSlug="spring-jam-night"
          isOpen={true}
          locale="en"
          lineupSlots={[
            {
              id: "slot-guitar",
              key: "guitar",
              label: "Guitar",
              seatCount: 1,
              allowOptional: true,
              displayOrder: 1,
            },
          ]}
          trackInfoFields={[]}
          tracks={[
            {
              id: "track-owned",
              proposedById: "user-proposer",
              proposedBy: {
                telegramUsername: "proposer",
                fullName: "Proposer",
              },
              song: {
                title: "Owned Song",
                artist: { name: "The Band" },
              },
              playbackRequired: false,
              trackInfoKeysJson: null,
              comment: "Old note",
              seats: [
                {
                  id: "seat-guitar",
                  seatIndex: 1,
                  label: "Guitar",
                  status: TrackSeatStatus.OPEN,
                  isOptional: true,
                  userId: null,
                  user: null,
                  lineupSlotId: "slot-guitar",
                  invites: [],
                },
              ],
            },
          ]}
          user={{
            id: "user-proposer",
            role: UserRole.USER,
            telegramUsername: "proposer",
            fullName: "Proposer",
          }}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(host.querySelector('button[title="Track settings"]')!);
    });

    expect(document.body.querySelector('[data-testid="track-settings-popover"]')).not.toBeNull();

    await act(async () => {
      fireEvent.pointerDown(document.body);
    });

    expect(document.body.querySelector('[data-testid="track-settings-popover"]')).toBeNull();
  });

  it("closes the invite popover when clicking outside it", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TrackBoardTable
          allowClosedOptionalRequests={false}
          eventSlug="spring-jam-night"
          inviteableUsers={[
            { id: "user-bass", telegramUsername: "boris_bass", fullName: "Boris Bass" },
          ]}
          isOpen={true}
          locale="en"
          lineupSlots={[
            {
              id: "slot-bass",
              key: "bass",
              label: "Bass",
              seatCount: 1,
              allowOptional: true,
              displayOrder: 1,
            },
          ]}
          trackInfoFields={[]}
          tracks={[
            {
              id: "track-owned",
              proposedById: "user-proposer",
              proposedBy: {
                telegramUsername: "proposer",
                fullName: "Proposer",
              },
              song: {
                title: "Invite Song",
                artist: { name: "The Band" },
              },
              playbackRequired: false,
              trackInfoKeysJson: null,
              comment: null,
              seats: [
                {
                  id: "seat-bass",
                  seatIndex: 1,
                  label: "Bass",
                  status: TrackSeatStatus.OPEN,
                  isOptional: false,
                  userId: null,
                  user: null,
                  lineupSlotId: "slot-bass",
                  invites: [],
                },
              ],
            },
          ]}
          user={{
            id: "user-proposer",
            role: UserRole.USER,
            telegramUsername: "proposer",
            fullName: "Proposer",
          }}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(host.querySelector('button[title="Invite player to Bass"]')!);
    });

    expect(host.querySelector('input[aria-label="Search registered musicians"]')).not.toBeNull();

    await act(async () => {
      fireEvent.pointerDown(document.body);
    });

    expect(host.querySelector('input[aria-label="Search registered musicians"]')).toBeNull();
  });
});
