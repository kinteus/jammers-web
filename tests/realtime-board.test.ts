import { describe, expect, it } from "vitest";

import {
  buildBoardUpdateMessage,
  parseBoardUpdateMessage,
} from "@/server/board-realtime";

describe("board realtime messages", () => {
  it("serializes compact board update events for websocket clients", () => {
    const message = buildBoardUpdateMessage({
      eventId: "event-1",
      reason: "seat-claimed",
    });

    expect(parseBoardUpdateMessage(message)).toEqual({
      eventId: "event-1",
      reason: "seat-claimed",
      type: "board-updated",
    });
  });

  it("rejects malformed realtime payloads", () => {
    expect(parseBoardUpdateMessage("{}")).toBeNull();
    expect(parseBoardUpdateMessage("not-json")).toBeNull();
  });
});
