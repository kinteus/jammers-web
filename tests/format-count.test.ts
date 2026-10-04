import { describe, expect, it } from "vitest";

import { COUNT_FORMS, formatCount } from "@/lib/i18n";

describe("formatCount", () => {
  it("uses singular and plural in English", () => {
    expect(formatCount("en", 1, COUNT_FORMS.tracks)).toBe("1 track");
    expect(formatCount("en", 133, COUNT_FORMS.tracks)).toBe("133 tracks");
    expect(formatCount("en", 36, COUNT_FORMS.gigs)).toBe("36 gigs");
  });

  it("uses the three Russian plural forms", () => {
    expect(formatCount("ru", 1, COUNT_FORMS.tracks)).toBe("1 трек");
    expect(formatCount("ru", 3, COUNT_FORMS.tracks)).toBe("3 трека");
    expect(formatCount("ru", 11, COUNT_FORMS.tracks)).toBe("11 треков");
    expect(formatCount("ru", 21, COUNT_FORMS.gigs)).toBe("21 гиг");
  });
});

describe("glossary count forms", () => {
  it("formats songs, performed songs and participants", () => {
    expect(formatCount("en", 1, COUNT_FORMS.performedSongs)).toBe("1 performed song");
    expect(formatCount("ru", 23, COUNT_FORMS.performedSongs)).toBe("23 песни из сетлиста");
    expect(formatCount("ru", 5, COUNT_FORMS.participants)).toBe("5 участников");
    expect(formatCount("ru", 2, COUNT_FORMS.sharedSongs)).toBe("2 общие песни");
  });
});
