import { describe, expect, it } from "vitest";

import { getNextSetlistOrderIndex } from "@/lib/domain/setlist-order";

describe("getNextSetlistOrderIndex", () => {
  it("uses the next max order index instead of count plus one", () => {
    expect(
      getNextSetlistOrderIndex([
        { orderIndex: 1 },
        { orderIndex: 2 },
        { orderIndex: 4 },
        { orderIndex: 5 },
        { orderIndex: 6 },
      ]),
    ).toBe(7);
  });

  it("starts an empty section at one", () => {
    expect(getNextSetlistOrderIndex([])).toBe(1);
  });
});
