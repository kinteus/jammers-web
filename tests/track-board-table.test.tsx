/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { TrackSeatStatus, UserRole } from "@prisma/client";
import { fireEvent } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMissingRequiredSeatLabels,
  getMobileSeatDisplayLabel,
  sortTracksBySeatAvailability,
  TrackBoardTable,
} from "@/components/track-board-table";
import { cancelTrackAction } from "@/server/actions";

vi.mock("@/server/actions", () => ({
  cancelTrackAction: vi.fn(),
  claimSeatInlineAction: vi.fn(),
  inviteToSeatAction: vi.fn(),
  inviteToSeatInlineAction: vi.fn(),
  releaseSeatInlineAction: vi.fn(),
  updateTrackArrangementAction: vi.fn(),
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
                id: "song-fully-ready",
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
              song: { id: "song-numbered", title: "Numbered Song", artist: { name: "The Band" } },
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

  it("uses the song title as the only visible YouTube link in row headers", async () => {
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
              id: "track-youtube",
              proposedById: "user-proposer",
              proposedBy: { telegramUsername: "proposer", fullName: "Proposer" },
              song: { id: "song-youtube", title: "Linked Song", artist: { name: "Linked Band" } },
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

    const youtubeLinks = [...host.querySelectorAll<HTMLAnchorElement>('a[href*="youtube.com/results"]')];

    expect(youtubeLinks.some((link) => link.textContent?.includes("Linked Song"))).toBe(true);
    expect(youtubeLinks.every((link) => !link.textContent?.includes("Open on YouTube"))).toBe(true);
    expect(host.textContent).not.toContain("Open on YouTube");
  });

  it("shows a compact YouTube link in the mobile song header", async () => {
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
              id: "track-mobile-youtube",
              proposedById: "user-proposer",
              proposedBy: { telegramUsername: "proposer", fullName: "Proposer" },
              song: { id: "song-youtube", title: "Mobile Link", artist: { name: "Linked Band" } },
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

    const mobileYoutubeLink = host.querySelector<HTMLAnchorElement>(
      '[data-mobile-youtube-link="track-mobile-youtube"]',
    );
    expect(mobileYoutubeLink?.href).toContain("youtube.com/results");
    expect(mobileYoutubeLink?.textContent).toContain("YouTube");
  });

  it("summarizes missing required instruments for collapsed mobile songs", () => {
    expect(
      getMissingRequiredSeatLabels([
        {
          label: "Vocals",
          status: TrackSeatStatus.CLAIMED,
          isOptional: false,
        },
        {
          label: "Drums",
          status: TrackSeatStatus.OPEN,
          isOptional: false,
        },
        {
          label: "Guitar",
          status: TrackSeatStatus.OPEN,
          isOptional: true,
        },
        {
          label: "Keys",
          status: TrackSeatStatus.UNAVAILABLE,
          isOptional: false,
        },
      ]),
    ).toEqual(["Drums"]);
  });

  it("labels mobile n/a positions with their instrument name", () => {
    expect(
      getMobileSeatDisplayLabel(
        {
          label: "Keys",
          status: TrackSeatStatus.UNAVAILABLE,
          isOptional: false,
          user: null,
        },
        "en",
      ),
    ).toBe("Keys · n/a");
  });

  it("closes the track notes popover when clicking outside it", async () => {
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
              id: "track-notes",
              proposedById: "user-proposer",
              proposedBy: { telegramUsername: "proposer", fullName: "Proposer" },
              song: { id: "song-notes", title: "Notes Song", artist: { name: "The Band" } },
              playbackRequired: false,
              trackInfoKeysJson: null,
              comment: "Keep the bridge quiet.",
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

    const notesTrigger = host.querySelector<HTMLElement>('[title="Track notes"]');
    expect(notesTrigger).not.toBeNull();

    await act(async () => {
      fireEvent.click(notesTrigger!);
    });

    expect(document.body.querySelector('[data-testid="track-notes-popover"]')?.textContent).toContain(
      "Keep the bridge quiet.",
    );

    await act(async () => {
      fireEvent.pointerDown(document.body);
    });

    expect(document.body.querySelector('[data-testid="track-notes-popover"]')).toBeNull();
  });

  it("uses green join buttons for optional seats while required seats stay gold", async () => {
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
              id: "slot-guitar",
              key: "guitar",
              label: "Guitar",
              seatCount: 2,
              allowOptional: true,
              displayOrder: 1,
            },
          ]}
          trackInfoFields={[]}
          tracks={[
            {
              id: "track-join-colors",
              proposedById: "user-proposer",
              proposedBy: { telegramUsername: "proposer", fullName: "Proposer" },
              song: { id: "song-join-colors", title: "Color Song", artist: { name: "The Band" } },
              playbackRequired: false,
              trackInfoKeysJson: null,
              comment: null,
              seats: [
                {
                  id: "seat-required",
                  seatIndex: 1,
                  label: "Guitar 1",
                  status: TrackSeatStatus.OPEN,
                  isOptional: false,
                  userId: null,
                  user: null,
                  lineupSlotId: "slot-guitar",
                  invites: [],
                },
                {
                  id: "seat-optional",
                  seatIndex: 2,
                  label: "Guitar 2",
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

    const requiredButton = host.querySelector<HTMLButtonElement>('button[title="Join Guitar 1"]');
    const optionalButton = host.querySelector<HTMLButtonElement>('button[title="Join optional Guitar 2"]');

    expect(requiredButton?.className).toContain("bg-gold");
    expect(optionalButton?.className).toContain("bg-emerald");
    expect(optionalButton?.className).not.toContain("bg-gold");
  });

  it("closes pending seat activity popovers when clicking outside them", async () => {
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
              id: "track-requests",
              proposedById: "user-proposer",
              proposedBy: { telegramUsername: "proposer", fullName: "Proposer" },
              song: { id: "song-requests", title: "Request Song", artist: { name: "The Band" } },
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
                  invites: [
                    {
                      id: "invite-1",
                      status: "PENDING",
                      deliveryNote: null,
                      senderId: "user-proposer",
                      sender: { telegramUsername: "proposer", fullName: "Proposer" },
                      recipient: { telegramUsername: "guest", fullName: "Guest" },
                    },
                  ],
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

    const requestsTrigger = host.querySelector<HTMLElement>(
      '[title="Open pending requests"]',
    );
    expect(requestsTrigger).not.toBeNull();

    await act(async () => {
      fireEvent.click(requestsTrigger!);
    });

    const requestsDetails = requestsTrigger?.closest("details");
    expect(requestsDetails?.open).toBe(true);

    await act(async () => {
      fireEvent.pointerDown(document.body);
    });

    expect(requestsDetails?.open).toBe(false);
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
              song: { id: "song-my", title: "My Song", artist: { name: "My Band" } },
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
                id: "song-playback",
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

  it("shows the arrangement edit launcher to the track proposer on an open board", async () => {
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
                id: "song-owned",
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

    expect(host.querySelector('button[title="Редактировать трек"]')).not.toBeNull();
    // The old inline "track settings" popover is gone.
    expect(host.textContent).not.toContain("Сохранить настройки трека");
  });

  it("shows the arrangement edit launcher to admins even when the board is closed", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    await act(async () => {
      root.render(
        <TrackBoardTable
          allowClosedOptionalRequests={false}
          eventSlug="spring-jam-night"
          isOpen={false}
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
                id: "song-owned",
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
            id: "admin-1",
            role: UserRole.ADMIN,
            telegramUsername: "admin",
            fullName: "Admin",
          }}
        />,
      );
    });

    expect(host.querySelector('button[title="Edit track"]')).not.toBeNull();
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
                id: "song-invite",
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
