import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMarkdownHeadingId, MarkdownContent } from "@/components/markdown-content";

beforeEach(() => {
  vi.stubGlobal("React", React);
});

describe("markdown heading ids", () => {
  it("derives stable ids from heading text without markdown syntax", () => {
    expect(getMarkdownHeadingId("How it works")).toBe("how-it-works");
    expect(getMarkdownHeadingId("**What** matters")).toBe("what-matters");
    expect(getMarkdownHeadingId("Как всё устроено")).toBe("как-все-устроено");
  });

  it("only adds ids when asked, so other pages keep plain headings", () => {
    expect(renderToStaticMarkup(<MarkdownContent headingIds value="## How it works" />)).toContain(
      'id="how-it-works"',
    );
    expect(renderToStaticMarkup(<MarkdownContent value="## How it works" />)).not.toContain("id=");
  });
});
