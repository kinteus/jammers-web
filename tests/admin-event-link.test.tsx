/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { AdminEventLink } from "@/components/admin-event-link";

const navigation = vi.hoisted(() => ({ pending: false }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useLinkStatus: () => navigation,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows pending feedback until navigation completes and preserves the anchor", () => {
  vi.stubGlobal("React", React);
  navigation.pending = false;
  const props = { href: "/admin/events/gig", label: "Open event admin", pendingLabel: "Opening…" };
  const { rerender } = render(<AdminEventLink {...props} />);
  expect(screen.getByRole("link", { name: props.label }).getAttribute("href")).toBe(props.href);
  expect(screen.queryByRole("button")).toBeNull();

  navigation.pending = true;
  rerender(<AdminEventLink {...props} />);
  expect(screen.getByText(props.pendingLabel).getAttribute("aria-busy")).toBe("true");
  expect(screen.getByRole("link").querySelector("svg.animate-spin")).not.toBeNull();

  navigation.pending = false;
  rerender(<AdminEventLink {...props} />);
  expect(screen.queryByText(props.pendingLabel)).toBeNull();
  expect(screen.getByRole("link", { name: props.label })).toBeTruthy();
});
