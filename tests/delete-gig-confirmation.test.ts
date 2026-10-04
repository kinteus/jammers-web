import { describe, expect, it } from "vitest";

import { isDeleteGigConfirmationValid } from "@/lib/delete-gig-confirmation";

describe("isDeleteGigConfirmationValid", () => {
  it("accepts the exact title, ignoring surrounding spaces", () => {
    expect(isDeleteGigConfirmationValid("  Spring Jam Night ", "Spring Jam Night")).toBe(true);
  });

  it("rejects empty, partial or differently-cased input", () => {
    expect(isDeleteGigConfirmationValid("", "Spring Jam Night")).toBe(false);
    expect(isDeleteGigConfirmationValid("Spring", "Spring Jam Night")).toBe(false);
    expect(isDeleteGigConfirmationValid("spring jam night", "Spring Jam Night")).toBe(false);
  });
});
