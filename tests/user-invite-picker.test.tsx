/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UserInvitePicker } from "@/components/user-invite-picker";
const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal("React", React); vi.stubGlobal("fetch", fetchMock); vi.useFakeTimers(); fetchMock.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("requires typing before searching and selects a database suggestion", async () => {
  const onSelect = vi.fn();
  render(<UserInvitePicker ariaLabel="Invite musician" locale="en" selectedUserId="" onSelectedUserIdChange={onSelect} users={[{ id: "directory", fullName: "Directory User", telegramUsername: null }]} />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.change(input, { target: { value: "an" } });
  await act(async () => { vi.advanceTimersByTime(350); });
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ users: [{ id: "anna", fullName: "Anna", telegramUsername: "anna_drums" }] }) });
  fireEvent.change(input, { target: { value: "anna" } });
  await act(async () => { vi.advanceTimersByTime(350); });
  expect(screen.queryByText("Directory User")).toBeNull();
  fireEvent.click(screen.getByRole("option"));
  expect(onSelect).toHaveBeenLastCalledWith("anna");
});
it("discards stale suggestions after the search text changes", async () => {
  let resolveOld!: (value: unknown) => void;
  fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  render(<UserInvitePicker ariaLabel="Invite musician" locale="en" selectedUserId="" onSelectedUserIdChange={() => {}} users={[]} />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "anna" } });
  await act(async () => { vi.advanceTimersByTime(350); });
  fireEvent.change(input, { target: { value: "boris" } });
  await act(async () => { resolveOld({ ok: true, json: async () => ({ users: [{ id: "anna", fullName: "Anna", telegramUsername: "anna" }] }) }); });
  expect(screen.queryByRole("option")).toBeNull();
});
