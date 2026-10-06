import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("home page layout", () => {
  it("does not render separate Date, Time, and Venue summary cards for the featured gig", () => {
    const source = readFileSync("src/app/page.tsx", "utf8");

    expect(source).not.toContain("eventDetails");
    expect(source).not.toContain("formatGigTime");
  });
});
