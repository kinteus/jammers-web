import { describe, expect, it } from "vitest";

import { buildPublishedSetNotifications } from "@/server/published-set-notifications";

describe("published set notifications", () => {
  it("groups final set songs per musician and merges multiple positions on one track", () => {
    const notifications = buildPublishedSetNotifications({
      eventStartsAt: new Date("2026-05-01T19:30:00.000Z"),
      eventTitle: "Spring Jam Night",
      setlistItems: [
        {
          orderIndex: 1,
          track: {
            id: "track-1",
            song: {
              artist: { name: "Blur" },
              title: "Song 2",
            },
            seats: [
              {
                label: "Drums",
                userId: "u1",
                user: { id: "u1", telegramId: "tg-1" },
              },
              {
                label: "BV",
                userId: "u1",
                user: { id: "u1", telegramId: "tg-1" },
              },
              {
                label: "Bass",
                userId: "u2",
                user: { id: "u2", telegramId: "tg-2" },
              },
            ],
          },
        },
        {
          orderIndex: 3,
          track: {
            id: "track-2",
            song: {
              artist: { name: "Muse" },
              title: "Starlight",
            },
            seats: [
              {
                label: "Percussion",
                userId: "u1",
                user: { id: "u1", telegramId: "tg-1" },
              },
            ],
          },
        },
      ],
    });

    expect(notifications).toEqual([
      {
        eventStartsAt: new Date("2026-05-01T19:30:00.000Z"),
        eventTitle: "Spring Jam Night",
        recipientTelegramId: "tg-1",
        songs: [
          {
            orderIndex: 1,
            positions: ["Drums", "BV"],
            songLabel: "Blur - Song 2",
          },
          {
            orderIndex: 3,
            positions: ["Percussion"],
            songLabel: "Muse - Starlight",
          },
        ],
      },
      {
        eventStartsAt: new Date("2026-05-01T19:30:00.000Z"),
        eventTitle: "Spring Jam Night",
        recipientTelegramId: "tg-2",
        songs: [
          {
            orderIndex: 1,
            positions: ["Bass"],
            songLabel: "Blur - Song 2",
          },
        ],
      },
    ]);
  });
});
