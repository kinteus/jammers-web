import { describe, expect, it } from "vitest";

import {
  buildTelegramAdminSeatAssignedMessage,
  buildTelegramBoardClosedChannelMessage,
  buildTelegramInviteMessage,
  buildTelegramPublishedSetMessage,
} from "@/server/telegram-bot";

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

describe("telegram invite message", () => {
  it("includes a direct profile link for invite handling", () => {
    const message = buildTelegramInviteMessage({
      eventTitle: "Spring Jam Night",
      inviterLabel: "@anna_drums",
      profileUrl: "https://thejammers.org/profile",
      seatLabel: "Bass",
      songLabel: "Blur - Song 2",
    });

    expect(message).toContain("@anna_drums invited you to Blur - Song 2 (Bass) for Spring Jam Night.");
    expect(message).toContain('<a href="https://thejammers.org/profile">your profile invites</a>');
  });
});

describe("telegram admin seat assignment message", () => {
  it("names the assigned song, position, and gig", () => {
    const message = buildTelegramAdminSeatAssignedMessage({
      eventTitle: "Spring Jam Night",
      seatLabel: "Bass",
      songLabel: "Blur - Song 2",
    });

    expect(message).toContain("Ты добавлен(а) админом в сетлист");
    expect(message).toContain("Blur - Song 2");
    expect(message).toContain("Bass");
    expect(message).toContain("Spring Jam Night");
  });
});

describe("telegram board closed channel message", () => {
  it("formats venue and gig timing for the public channel post", () => {
    const message = buildTelegramBoardClosedChannelMessage({
      city: "Limassol",
      eventStartsAt: new Date("2026-05-01T16:30:00.000Z"),
      venueName: "Dusty Munky",
    });

    expect(message).toContain("🏁 Иии таблица закрыта!");
    expect(message).toContain("📍 Где: Dusty Munky, Limassol");
    expect(message).toContain("📅 Когда:");
    expect(message).toContain("19:30");
  });
});
