/**
 * @vitest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminSeatAssignControl } from "@/components/admin-seat-assign-control";

const refreshMock = vi.hoisted(() => vi.fn());
const adminAssignSeatActionMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("@/server/actions", () => ({
  adminAssignSeatAction: adminAssignSeatActionMock,
}));

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
  adminAssignSeatActionMock.mockResolvedValue(undefined);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("AdminSeatAssignControl", () => {
  it("assigns the selected autocomplete user by id", async () => {
    render(
      <AdminSeatAssignControl
        eventSlug="event-1"
        locale="en"
        seatId="seat-1"
        users={[
          { fullName: "Anna Drums", id: "user-anna", telegramUsername: "anna_drums" },
          { fullName: "Boris Bass", id: "user-boris", telegramUsername: "boris_bass" },
        ]}
      />,
    );

    fireEvent.focus(screen.getByLabelText("Search registered musicians"));
    fireEvent.change(screen.getByLabelText("Search registered musicians"), {
      target: { value: "boris" },
    });
    fireEvent.click(screen.getByRole("button", { name: /@boris_bass/i }));
    fireEvent.click(screen.getByRole("button", { name: /Assign/i }));

    await waitFor(() => expect(adminAssignSeatActionMock).toHaveBeenCalledTimes(1));
    const formData = adminAssignSeatActionMock.mock.calls[0]?.[0] as FormData;
    expect(formData.get("eventSlug")).toBe("event-1");
    expect(formData.get("seatId")).toBe("seat-1");
    expect(formData.get("userId")).toBe("user-boris");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
