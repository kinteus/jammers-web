import { describe, expect, it } from "vitest";

import { getSafeReturnTo } from "@/lib/return-to";

describe("getSafeReturnTo", () => {
  it("keeps relative app paths and strips auth noise", () => {
    expect(getSafeReturnTo("/events/spring-jam-night?authError=retry&view=mine")).toBe(
      "/events/spring-jam-night?view=mine",
    );
    expect(getSafeReturnTo("/about")).toBe("/about");
  });

  it("falls back for unsafe or empty targets", () => {
    expect(getSafeReturnTo("https://evil.example")).toBe("/profile");
    expect(getSafeReturnTo("//evil.example")).toBe("/profile");
    expect(getSafeReturnTo("")).toBe("/profile");
  });
});
