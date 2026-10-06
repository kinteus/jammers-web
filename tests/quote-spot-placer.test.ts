import { describe, expect, it } from "vitest";

import { getSpotTop } from "@/components/quote-spot-placer";

// A 400px section starting at y=100, 20px rounded corners, 40px tall bubble.
const section = { top: 100, bottom: 500, height: 400 } as DOMRect;

describe("getSpotTop", () => {
  it("starts right after the top corner and ends right before the bottom one", () => {
    expect(getSpotTop("start", section, 20, 20, 40)).toBe(120);
    expect(getSpotTop("end", section, 20, 20, 40)).toBe(440);
  });

  it("centres the bubble on the middle of the section", () => {
    expect(getSpotTop("middle", section, 20, 20, 40)).toBe(280);
  });

  it("puts the quarter spots halfway between the start, middle and end bubbles", () => {
    expect(getSpotTop("upper-quarter", section, 20, 20, 40)).toBe(200);
    expect(getSpotTop("lower-quarter", section, 20, 20, 40)).toBe(360);
  });
});
