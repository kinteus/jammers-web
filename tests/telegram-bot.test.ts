import { describe, expect, it } from "vitest";

import { buildTelegramPublishedSetMessage } from "@/server/telegram-bot";

describe("telegram published-set message", () => {
  it("includes the gig title and the participant songs", () => {
    const message = buildTelegramPublishedSetMessage({
      eventStartsAt: new Date("2026-05-01T19:30:00.000Z"),
      eventTitle: "Spring Jam Night",
      songs: [
        {
          orderIndex: 1,
          positions: ["Drums", "BV"],
          songLabel: "Blur - Song 2",
        },
        {
          orderIndex: 4,
          positions: ["Percussion"],
          songLabel: "Muse - Starlight",
        },
      ],
    });

    expect(message).toContain("Spring Jam Night");
    expect(message).toContain("1. Blur - Song 2 - Drums, BV");
    expect(message).toContain("4. Muse - Starlight - Percussion");
  });
});
