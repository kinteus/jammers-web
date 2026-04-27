/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { TrackSeatStatus, UserRole } from "@prisma/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TrackBoardTable } from "@/components/track-board-table";

vi.mock("@/server/actions", () => ({
  cancelTrackAction: vi.fn(),
  claimSeatInlineAction: vi.fn(),
  inviteToSeatAction: vi.fn(),
  releaseSeatInlineAction: vi.fn(),
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
  it("marks fully staffed tracks with a prominent ready state", async () => {
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
    expect(host.querySelector('[data-ready-badge="primary"]')?.textContent).toContain("Собрано");
  });
});
