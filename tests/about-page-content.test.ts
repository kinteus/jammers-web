import { describe, expect, it } from "vitest";

import { ABOUT_PAGE_CONTENT } from "@/lib/about-page-content";

describe("about page content", () => {
  it("does not ship placeholder contacts", () => {
    const placeholderContacts = ABOUT_PAGE_CONTENT.contacts.filter((contact) =>
      ["@replace_me", "replace-me@example.com", "+000 00 000000"].includes(contact.value),
    );

    expect(placeholderContacts).toHaveLength(0);
  });
});

describe("organizer names", () => {
  it("has a Latin spelling for English and Cyrillic for Russian", () => {
    for (const organizer of ABOUT_PAGE_CONTENT.organizers) {
      expect(organizer.name.en).toMatch(/^[A-Za-z][A-Za-z .'-]*$/);
      expect(organizer.name.ru).toMatch(/[А-Яа-яЁё]/);
    }
  });
});
