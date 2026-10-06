import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteFooter } from "@/components/site-footer";

beforeEach(() => {
  vi.stubGlobal("React", React);
});

describe("SiteFooter", () => {
  it("links to the profile as Sign in for guests and Profile for signed-in users", () => {
    const guest = renderToStaticMarkup(<SiteFooter locale="en" />);
    expect(guest).toContain('href="/profile"');
    expect(guest).toContain(">Sign in<");

    const member = renderToStaticMarkup(<SiteFooter isSignedIn locale="ru" />);
    expect(member).toContain(">Профиль<");
  });
});
