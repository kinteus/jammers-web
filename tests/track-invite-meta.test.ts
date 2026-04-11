import { describe, expect, it } from "vitest";

import {
  parseClosedOptionalSeatRequestMeta,
  serializeClosedOptionalSeatRequestMeta,
} from "@/lib/track-invite-meta";

describe("track invite meta", () => {
  it("round-trips valid closed optional seat request metadata", () => {
    const value = serializeClosedOptionalSeatRequestMeta({
      kind: "closed-opt-request",
      requesterId: "user-1",
      requesterLabel: "@anna",
      targetUserId: "user-2",
      targetLabel: "@boris",
      mode: "friend",
    });

    expect(parseClosedOptionalSeatRequestMeta(value)).toEqual({
      kind: "closed-opt-request",
      requesterId: "user-1",
      requesterLabel: "@anna",
      targetUserId: "user-2",
      targetLabel: "@boris",
      mode: "friend",
    });
  });

  it("rejects invalid or unrelated payloads", () => {
    expect(parseClosedOptionalSeatRequestMeta(null)).toBeNull();
    expect(parseClosedOptionalSeatRequestMeta("{\"kind\":\"other\"}")).toBeNull();
    expect(parseClosedOptionalSeatRequestMeta("not-json")).toBeNull();
  });
});
