/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackBoardFilters } from "@/components/track-board-filters";
const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname: () => "/events/gig", useRouter: () => ({ replace }) }));
const props = { activeView: "all" as const, locale: "en" as const, roleOptions: ["bass" as const], searchQuery: "", selectedRoles: [], showMineView: true, visibleCount: 2, participants: [{ id: "anna", label: "Anna" }] };
beforeEach(() => { vi.stubGlobal("React", React); vi.useFakeTimers(); replace.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("board filters", () => {
  it("keeps newer input when an older server response arrives", () => {
    const { rerender } = render(<TrackBoardFilters {...props} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "met" } });
    act(() => vi.advanceTimersByTime(250));
    expect(replace).toHaveBeenLastCalledWith("/events/gig?q=met", { scroll: false });
    fireEvent.change(input, { target: { value: "metallica" } });
    rerender(<TrackBoardFilters {...props} searchQuery="met" />);
    expect(input.value).toBe("metallica");
    act(() => vi.advanceTimersByTime(250));
    expect(replace).toHaveBeenLastCalledWith("/events/gig?q=metallica", { scroll: false });
    rerender(<TrackBoardFilters {...props} searchQuery="metallica" />);
    expect(input.value).toBe("metallica");
  });
  it("navigates back to an empty query even while a previous search is in flight", () => {
    const { rerender } = render(<TrackBoardFilters {...props} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "metal" } });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    act(() => vi.advanceTimersByTime(250));
    expect(replace).toHaveBeenLastCalledWith("/events/gig", { scroll: false });
    rerender(<TrackBoardFilters {...props} searchQuery="metal" />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });
  it("keeps spaces while typing multi-word searches", () => {
    const { rerender } = render(<TrackBoardFilters {...props} searchQuery="Pink" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pink " } });
    rerender(<TrackBoardFilters {...props} searchQuery="Pink" selectedRoles={[]} />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Pink ");
  });
  it("does not restore a stale response after Clear", () => {
    const { rerender } = render(<TrackBoardFilters {...props} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "metal" } });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    rerender(<TrackBoardFilters {...props} searchQuery="metal" />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
    expect(replace).toHaveBeenLastCalledWith("/events/gig", { scroll: false });
  });
  it("restores filters on browser history navigation", () => {
    const { rerender } = render(<TrackBoardFilters {...props} searchQuery="metal" />);
    window.history.replaceState(null, "", "/events/gig?q=rock&participant=anna");
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    rerender(<TrackBoardFilters {...props} searchQuery="rock" selectedParticipant="anna" />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("rock");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("anna");
  });
  it("combines rapid role, search and participant changes and clears them together", () => {
    render(<TrackBoardFilters {...props} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: "Bass" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "anna" } });
    act(() => vi.advanceTimersByTime(250));
    expect(replace).toHaveBeenLastCalledWith("/events/gig?q=test&roles=bass&participant=anna", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    act(() => vi.advanceTimersByTime(250));
    expect(replace).toHaveBeenLastCalledWith("/events/gig", { scroll: false });
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });
});
