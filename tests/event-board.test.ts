import { describe, expect, it } from "vitest";

import { expandSeatColumns } from "@/lib/event-board";

describe("event board helpers", () => {
  it("expands lineup slots into stable seat columns", () => {
    const columns = expandSeatColumns([
      {
        id: "slot-1",
        key: "guitar",
        label: "Guitar",
        seatCount: 2,
        allowOptional: true,
        displayOrder: 1,
      },
      {
        id: "slot-2",
        key: "vocals",
        label: "Vocals",
        seatCount: 1,
        allowOptional: true,
        displayOrder: 2,
      },
    ]);

    expect(columns).toEqual([
      {
        slotId: "slot-1",
        lineupKey: "guitar",
        label: "Guitar 1",
        shortLabel: "Gtr 1",
        seatIndex: 1,
        seatKey: "Guitar 1:1",
      },
      {
        slotId: "slot-1",
        lineupKey: "guitar",
        label: "Guitar 2",
        shortLabel: "Gtr 2",
        seatIndex: 2,
        seatKey: "Guitar 2:2",
      },
      {
        slotId: "slot-2",
        lineupKey: "vocals",
        label: "Vocals",
        shortLabel: "Vocals",
        seatIndex: 1,
        seatKey: "Vocals:1",
      },
    ]);
  });
});
