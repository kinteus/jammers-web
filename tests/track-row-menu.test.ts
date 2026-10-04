import { describe, expect, it } from "vitest";

import { getDeleteTrackConfirmMessage } from "@/components/track-row-menu";

describe("getDeleteTrackConfirmMessage", () => {
  it("names the song and how many players would lose a seat", () => {
    expect(getDeleteTrackConfirmMessage("Everlong", 3, "en")).toBe(
      'Delete "Everlong" from the board? 3 participants lose their seats.',
    );
    expect(getDeleteTrackConfirmMessage("Everlong", 1, "en")).toContain("1 participant loses their seat");
  });

  it("keeps the message short when nobody has joined yet", () => {
    expect(getDeleteTrackConfirmMessage("Everlong", 0, "en")).toBe('Delete "Everlong" from the board?');
  });

  it("is translated to Russian", () => {
    expect(getDeleteTrackConfirmMessage("Everlong", 2, "ru")).toContain("потеряют место: 2");
  });
});
