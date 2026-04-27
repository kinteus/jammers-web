import { describe, expect, it } from "vitest";

import { ABOUT_PAGE_CONTENT } from "@/lib/about-page-content";

describe("about page content", () => {
  it("keeps placeholder contacts non-clickable until real details are provided", () => {
    const placeholderContacts = ABOUT_PAGE_CONTENT.contacts.filter((contact) =>
      ["@replace_me", "replace-me@example.com", "+000 00 000000"].includes(contact.value),
    );

    expect(placeholderContacts.length).toBeGreaterThan(0);
    for (const contact of placeholderContacts) {
      expect(contact.href).toBeUndefined();
    }
  });
});
