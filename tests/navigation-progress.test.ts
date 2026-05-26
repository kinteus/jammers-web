import { describe, expect, it } from "vitest";

import { isRouteNavigation } from "@/lib/navigation-progress";

describe("isRouteNavigation", () => {
  it("starts progress for a same-origin page transition", () => {
    expect(
      isRouteNavigation({
        currentHref: "http://localhost/",
        targetHref: "http://localhost/archive",
      }),
    ).toBe(true);
  });

  it("ignores hash-only, external, and new-tab navigation", () => {
    expect(
      isRouteNavigation({
        currentHref: "http://localhost/archive",
        targetHref: "http://localhost/archive#published",
      }),
    ).toBe(false);
    expect(
      isRouteNavigation({
        currentHref: "http://localhost/",
        targetHref: "https://example.com/",
      }),
    ).toBe(false);
    expect(
      isRouteNavigation({
        currentHref: "http://localhost/",
        targetHref: "http://localhost/admin",
        target: "_blank",
      }),
    ).toBe(false);
  });
});
