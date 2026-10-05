import { describe, expect, it } from "vitest";

import { getGigDisplayTitle, isDateOnlyGigTitle } from "@/lib/gig-title";

// 17:00 UTC = 20:00 Cyprus, same calendar day.
const startsAt = "2023-06-12T17:00:00.000Z";

describe("gig display titles", () => {
  it("recognises the date-only title styles found in the data", () => {
    expect(isDateOnlyGigTitle("Гиг The Jammers 12 of June 2023")).toBe(true);
    expect(isDateOnlyGigTitle("Гиг The Jammers 27 сентября")).toBe(true);
    expect(isDateOnlyGigTitle("The Jammers Gig 18/10/26")).toBe(true);
    expect(isDateOnlyGigTitle("The Jammers Hot June")).toBe(false);
    expect(isDateOnlyGigTitle("Spring Jam Night")).toBe(false);
  });

  it("rebuilds date-only titles in the visitor's language", () => {
    const gig = { title: "Гиг The Jammers 12 of June 2023", startsAt };
    expect(getGigDisplayTitle(gig, "en")).toBe("The Jammers · 12 June 2023");
    expect(getGigDisplayTitle(gig, "ru")).toBe("The Jammers · 12 июня 2023");
  });

  it("keeps custom titles as they are", () => {
    expect(getGigDisplayTitle({ title: "The Jammers Hot June", startsAt }, "ru")).toBe(
      "The Jammers Hot June",
    );
  });
});
