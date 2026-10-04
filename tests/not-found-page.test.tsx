import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const locale = vi.hoisted(() => ({ value: "en" as "en" | "ru" }));

vi.mock("@/lib/i18n-server", () => ({
  getLocale: async () => locale.value,
}));

import NotFound from "@/app/not-found";

beforeEach(() => {
  vi.stubGlobal("React", React);
});

describe("NotFound", () => {
  it("offers a way back to the next gig and the setlists", async () => {
    locale.value = "en";
    const html = renderToStaticMarkup(await NotFound());

    expect(html).toContain("This page went off-stage");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/archive"');
  });

  it("is translated to Russian", async () => {
    locale.value = "ru";
    expect(renderToStaticMarkup(await NotFound())).toContain("Эта страница ушла со сцены");
  });
});
