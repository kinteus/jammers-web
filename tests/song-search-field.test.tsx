/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SongSearchField } from "@/components/song-search-field";

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

describe("SongSearchField", () => {
  it("submits the selected iTunes external id with the song", () => {
    const { container } = render(
      <SongSearchField
        locale="ru"
        onSelectedChange={() => undefined}
        selected={{
          artistName: "Thornhill",
          artworkUrl: null,
          collectionName: "BODIES",
          durationSeconds: 193,
          externalId: "1787004043",
          externalUrl: null,
          trackTitle: "nerv",
        }}
      />,
    );

    expect(
      container.querySelector<HTMLInputElement>('input[name="selectedExternalId"]')?.value,
    ).toBe("1787004043");
  });

  it("debounces iTunes search while the user keeps typing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SongSearchField
        locale="ru"
        onSelectedChange={() => undefined}
        selected={null}
      />,
    );

    const input = screen.getByPlaceholderText("Начни вводить название песни или артиста");

    await act(async () => {
      fireEvent.change(input, { target: { value: "m" } });
      fireEvent.change(input, { target: { value: "mi" } });
      vi.advanceTimersByTime(300);
      fireEvent.change(input, { target: { value: "min" } });
      vi.advanceTimersByTime(399);
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("query=min");
  });
});
