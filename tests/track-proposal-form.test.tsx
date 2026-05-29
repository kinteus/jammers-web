/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TrackProposalForm } from "@/components/track-proposal-form";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderForm({
  createTrackAction = () => undefined,
  locale = "en",
}: {
  createTrackAction?: (formData: FormData) => void | Promise<void>;
  locale?: "en" | "ru";
} = {}) {
  return render(
    <TrackProposalForm
      createTrackAction={createTrackAction}
      eventId="event-1"
      eventSlug="event-1"
      inviteableUsers={[]}
      lineupSlots={[
        {
          id: "slot-vocals",
          key: "vocals",
          label: "Vocals",
          seatCount: 1,
          allowOptional: true,
          displayOrder: 1,
        },
      ]}
      locale={locale}
      trackInfoFields={[]}
    />,
  );
}

async function selectSong() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        results: [
          {
            artistName: "Дайте Танк (!)",
            artworkUrl: null,
            collectionName: null,
            durationSeconds: 180,
            externalId: "111",
            externalUrl: null,
            trackTitle: "Веселиться",
          },
        ],
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);

  const input = screen.getByPlaceholderText(/Start typing a song title|Начни вводить/i);

  await act(async () => {
    fireEvent.change(input, { target: { value: "Дайте Танк Веселиться" } });
    vi.advanceTimersByTime(400);
  });
  await act(async () => {
    await Promise.resolve();
  });

  const option = screen.getByRole("button", { name: /Веселиться/ });
  await act(async () => {
    fireEvent.click(option);
  });
}

describe("TrackProposalForm", () => {
  it("keeps the publish button disabled until a song is selected", () => {
    renderForm();

    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Publish proposal to board",
    });
    expect(button.disabled).toBe(true);
  });

  it("enables the publish button once a track is chosen from search", async () => {
    renderForm();
    await selectSong();

    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Publish proposal to board" })
        .disabled,
    ).toBe(false);
  });

  it("shows the self-seat validation before submitting and keeps composer state", async () => {
    const createTrackAction = vi.fn();
    renderForm({ createTrackAction, locale: "ru" });
    await selectSong();

    const publishButton = screen.getByRole<HTMLButtonElement>("button", {
      name: "Опубликовать трек в сетлист",
    });

    await act(async () => {
      publishButton.closest("form")?.requestSubmit(publishButton);
    });

    expect(createTrackAction).not.toHaveBeenCalled();
    expect(screen.getByText("Сначала впишись сам")).not.toBeNull();
    expect(screen.getByText("Веселиться")).not.toBeNull();
  });
});
