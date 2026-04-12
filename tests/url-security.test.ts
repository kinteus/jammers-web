import { describe, expect, it } from "vitest";

import {
  normalizeAppleMusicUrl,
  normalizeExternalUrl,
  normalizeVenueMapUrl,
} from "@/lib/url-security";

describe("url security", () => {
  it("rejects javascript urls", () => {
    expect(normalizeVenueMapUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("keeps safe venue urls", () => {
    expect(normalizeVenueMapUrl("https://maps.google.com/?q=Limassol")).toBe(
      "https://maps.google.com/?q=Limassol",
    );
  });

  it("allows only trusted apple music hosts for preview links", () => {
    expect(normalizeAppleMusicUrl("https://music.apple.com/us/song/test")).toBe(
      "https://music.apple.com/us/song/test",
    );
    expect(normalizeAppleMusicUrl("https://evil.example/song")).toBeNull();
  });
});
