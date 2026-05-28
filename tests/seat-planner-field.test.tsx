/**
 * @vitest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SeatPlannerField } from "@/components/seat-planner-field";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("SeatPlannerField", () => {
  it("filters inviteable users by typing while proposing a track", () => {
    render(
      <form data-testid="proposal-form">
        <SeatPlannerField
          inviteableUsers={[
            { fullName: "Anna Drums", id: "user-anna", telegramUsername: "anna_drums" },
            { fullName: "Boris Bass", id: "user-boris", telegramUsername: "boris_bass" },
          ]}
          lineupSlots={[
            {
              allowOptional: true,
              displayOrder: 1,
              id: "slot-bass",
              key: "bass",
              label: "Bass",
              seatCount: 1,
            },
          ]}
          locale="en"
        />
      </form>,
    );

    const inviteInput = screen.getByRole("combobox", { name: "Invite Bass" });
    fireEvent.focus(inviteInput);
    fireEvent.change(inviteInput, { target: { value: "boris" } });

    const listbox = screen.getByRole("listbox", { name: "Invite Bass" });
    expect(within(listbox).getByRole("option", { name: /@boris_bass/i })).toBeTruthy();
    expect(within(listbox).queryByRole("option", { name: /@anna_drums/i })).toBeNull();

    fireEvent.click(within(listbox).getByRole("option", { name: /@boris_bass/i }));

    expect((inviteInput as HTMLInputElement).value).toBe("@boris_bass");
    const hiddenInvite = document.querySelector<HTMLInputElement>(
      'input[name="inviteSeatRequests"]',
    );
    expect(hiddenInvite?.value).toBe("Bass:1|user-boris");
  });
});
